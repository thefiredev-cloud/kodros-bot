export const MESHVAULT_ORIGIN = "https://meshvault.ai";
export const MESHVAULT_CONTACT_EMAIL = "tanner@kodros.ai";
export const INSTALL_LEAD_PATH = "/api/install-lead";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_MAX = 120;
const COMPANY_MAX = 160;
const NOTES_MAX = 2000;

export type FetchLike = (
  input: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

export class CommerceError extends Error {
  readonly code: string;
  readonly contact?: string;

  constructor(code: string, message: string, contact?: string) {
    super(message);
    this.name = "CommerceError";
    this.code = code;
    this.contact = contact;
  }
}

export function foundingInstallLeadUrl(): string {
  return `${MESHVAULT_ORIGIN}${INSTALL_LEAD_PATH}`;
}

export function isUnreadableCommerceFailure(error: unknown): boolean {
  return error instanceof TypeError;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export type FoundingInstallLeadInput = {
  name: string;
  email: string;
  company?: string;
  notes?: string;
};

export type FoundingInstallLead = {
  name: string;
  email: string;
  company: string;
  notes: string;
};

function cleanField(value: string | undefined, max: number): string {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

export function normalizeFoundingInstallLead(input: FoundingInstallLeadInput): FoundingInstallLead {
  return {
    name: cleanField(input.name, NAME_MAX),
    email: cleanField(input.email, 254).toLowerCase(),
    company: cleanField(input.company, COMPANY_MAX),
    notes: cleanField(input.notes, NOTES_MAX),
  };
}

export function validateFoundingInstallLead(
  input: FoundingInstallLeadInput,
): { ok: true; lead: FoundingInstallLead } | { ok: false; error: string } {
  const lead = normalizeFoundingInstallLead(input);
  if (!lead.name) return { ok: false, error: "Name is required." };
  if (!lead.email || !EMAIL_RE.test(lead.email))
    return { ok: false, error: "A real email is required." };
  return { ok: true, lead };
}

export function foundingInstallMailto(input: FoundingInstallLeadInput): string {
  const lead = normalizeFoundingInstallLead(input);
  const subject = encodeURIComponent(
    lead.name ? `Founding install lead: ${lead.name}` : "Founding install lead",
  );
  const body = encodeURIComponent(
    [
      "Founding / managed install lead from Kodros",
      "",
      `Name: ${lead.name || "(not given)"}`,
      `Email: ${lead.email || "(not given)"}`,
      `Company: ${lead.company || "(not given)"}`,
      "",
      "Notes:",
      lead.notes || "(none)",
    ].join("\n"),
  );
  return `mailto:${MESHVAULT_CONTACT_EMAIL}?subject=${subject}&body=${body}`;
}

export type FoundingInstallLeadResult =
  | { status: "submitted"; inbox: string }
  | { status: "contact"; inbox: string; message: string };

export async function submitFoundingInstallLead(
  input: FoundingInstallLeadInput,
  fetchImpl: FetchLike,
): Promise<FoundingInstallLeadResult> {
  const parsed = validateFoundingInstallLead(input);
  if (!parsed.ok) throw new CommerceError("invalid_lead", parsed.error, MESHVAULT_CONTACT_EMAIL);

  let body: unknown;
  try {
    const response = await fetchImpl(foundingInstallLeadUrl(), {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(parsed.lead),
    });
    body = await response.json();
  } catch (error) {
    if (isUnreadableCommerceFailure(error)) {
      return {
        status: "contact",
        inbox: MESHVAULT_CONTACT_EMAIL,
        message: "The form could not send from this origin. Email tanner@kodros.ai instead.",
      };
    }
    throw new CommerceError("network_error", "Could not submit the lead.", MESHVAULT_CONTACT_EMAIL);
  }

  const record = asRecord(body);
  if (!record) {
    throw new CommerceError(
      "invalid_response",
      "Lead response was not JSON.",
      MESHVAULT_CONTACT_EMAIL,
    );
  }
  const error = readString(record, "error");
  const inbox = readString(record, "contact") ?? MESHVAULT_CONTACT_EMAIL;
  if (error === "mailer_not_configured" || error === "mailer_error") {
    return {
      status: "contact",
      inbox,
      message:
        readString(record, "message") ??
        "The form could not send. Email tanner@kodros.ai and a person will reply.",
    };
  }
  if (error) {
    throw new CommerceError(
      error,
      readString(record, "message") ?? "The lead was not sent.",
      inbox,
    );
  }
  if (record.ok !== true) {
    throw new CommerceError("invalid_response", "Lead response was missing ok: true.", inbox);
  }
  return { status: "submitted", inbox: readString(record, "inbox") ?? inbox };
}
