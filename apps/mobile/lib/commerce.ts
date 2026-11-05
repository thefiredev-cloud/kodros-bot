export const INSTALL_LEAD_PATH = "/api/install-lead";
export const INSTALL_INBOX = "tanner@kodros.ai";

export type InstallLead = {
  name: string;
  email: string;
  company?: string;
  notes?: string;
  website?: string;
};

export function leadErrorMessage(status: number, data: { error?: string }) {
  if (data.error === "mailer_not_configured" || status === 503) {
    return "The form could not send. Email tanner@kodros.ai and a person will reply.";
  }
  if (data.error === "invalid_lead" || status === 400) {
    return "Name and a real email are required. No message was sent.";
  }
  if (data.error === "rate_limited" || status === 429) {
    return "Too many attempts. Email tanner@kodros.ai instead.";
  }
  return "The form could not send. Email tanner@kodros.ai. No fake inbox was used.";
}

export async function submitInstallLead(
  apiBase: string,
  lead: InstallLead,
  opts: { fetchImpl?: typeof fetch } = {},
) {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const response = await fetchImpl(`${apiBase.replace(/\/$/, "")}${INSTALL_LEAD_PATH}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      origin: "meshbot://",
    },
    body: JSON.stringify(lead),
  });
  const data = (await response.json().catch(() => ({}))) as { error?: string; contact?: string };
  if (!response.ok) {
    throw new Error(leadErrorMessage(response.status, data));
  }
  return { ok: true as const };
}
