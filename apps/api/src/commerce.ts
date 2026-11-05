const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_MAX = 120;
const COMPANY_MAX = 160;
const NOTES_MAX = 2000;
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;

export const INSTALL_LEAD = {
  brand: "Kodros",
  inbox: "tanner@kodros.ai",
  from: "Kodros <contact@meshvault.ai>",
} as const;

export type CommerceDeps = {
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
};

type RateWindow = { count: number; resetAt: number };

const rateWindows = new Map<string, RateWindow>();

export function resetCommerceRateLimit() {
  rateWindows.clear();
}

export function cleanField(value: unknown, max: number) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

export function normalizeLead(raw: unknown) {
  const body = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    name: cleanField(body.name, NAME_MAX),
    email: cleanField(body.email, 254).toLowerCase(),
    company: cleanField(body.company, COMPANY_MAX),
    notes: cleanField(body.notes, NOTES_MAX),
    website: cleanField(body.website, 200),
  };
}

export function validateLead(lead: ReturnType<typeof normalizeLead>) {
  if (lead.website) return null;
  if (!lead.name) return "name is required";
  if (!lead.email || !EMAIL_RE.test(lead.email)) return "a real email is required";
  return null;
}

export function buildLeadEmail(lead: {
  name: string;
  email: string;
  company: string;
  notes: string;
}) {
  const lines = [
    "Founding / managed install lead from Kodros",
    "",
    `Name: ${lead.name}`,
    `Email: ${lead.email}`,
    `Company: ${lead.company || "(not given)"}`,
    "",
    "Notes:",
    lead.notes || "(none)",
    "",
    "Reply to this message to reach the person who submitted the form.",
  ];
  return {
    from: INSTALL_LEAD.from,
    to: [INSTALL_LEAD.inbox],
    reply_to: lead.email,
    subject: `Founding install lead: ${lead.name}`,
    text: lines.join("\n"),
  };
}

export async function sendViaResend(
  email: ReturnType<typeof buildLeadEmail>,
  opts: { env?: NodeJS.ProcessEnv; fetchImpl?: typeof fetch } = {},
) {
  const env = opts.env ?? process.env;
  const apiKey = (env.RESEND_API_KEY || "").trim();
  if (!apiKey) throw new Error("resend_not_configured");
  const fetchImpl = opts.fetchImpl ?? fetch;
  const res = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(email),
  });
  const data = (await res.json().catch(() => ({}))) as { id?: string; name?: string };
  if (!res.ok) throw new Error(`resend_error:${data.name || res.status}`);
  return data.id || "resend_ok";
}

export async function handleInstallLead(
  request: Request,
  deps: CommerceDeps = {},
): Promise<Response> {
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  if (request.method === "HEAD") return emptyOk();
  if (request.method !== "POST") return json(405, { error: "method_not_allowed" });

  const limited = consumeRateLimit(`lead:${clientKey(request)}`);
  if (!limited.allowed) {
    return json(
      429,
      {
        error: "rate_limited",
        brand: INSTALL_LEAD.brand,
        message: `Too many form attempts. Email ${INSTALL_LEAD.inbox} instead.`,
        contact: INSTALL_LEAD.inbox,
        retryAfterSeconds: limited.retryAfterSeconds,
      },
      { "retry-after": String(limited.retryAfterSeconds) },
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json(400, {
      error: "invalid_json",
      brand: INSTALL_LEAD.brand,
      message: "The form body was not readable JSON. No email was sent.",
      contact: INSTALL_LEAD.inbox,
    });
  }

  const lead = normalizeLead(raw);
  if (lead.website) {
    return json(200, { ok: true, brand: INSTALL_LEAD.brand });
  }

  if (validateLead(lead)) {
    return json(400, {
      error: "invalid_lead",
      brand: INSTALL_LEAD.brand,
      message: "Name and a real email are required. No email was sent.",
      contact: INSTALL_LEAD.inbox,
    });
  }

  try {
    const emailId = await sendViaResend(buildLeadEmail(lead), deps);
    return json(200, {
      ok: true,
      brand: INSTALL_LEAD.brand,
      inbox: INSTALL_LEAD.inbox,
      emailId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    if (message === "resend_not_configured") {
      return json(503, {
        error: "mailer_not_configured",
        brand: INSTALL_LEAD.brand,
        message: `The form could not send. Email ${INSTALL_LEAD.inbox} and a person will reply.`,
        contact: INSTALL_LEAD.inbox,
      });
    }
    return json(502, {
      error: "mailer_error",
      brand: INSTALL_LEAD.brand,
      message: `The form could not send. Email ${INSTALL_LEAD.inbox}. No fake inbox was used.`,
      contact: INSTALL_LEAD.inbox,
    });
  }
}

function json(
  status: number,
  body: Record<string, unknown>,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });
}

function emptyOk(): Response {
  return new Response(null, {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function clientKey(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

function consumeRateLimit(key: string) {
  const now = Date.now();
  const current = rateWindows.get(key);
  if (!current || current.resetAt <= now) {
    rateWindows.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (current.count >= RATE_LIMIT) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }
  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}
