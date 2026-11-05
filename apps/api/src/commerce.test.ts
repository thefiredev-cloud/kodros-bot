import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildLeadEmail,
  handleInstallLead,
  INSTALL_LEAD,
  normalizeLead,
  resetCommerceRateLimit,
  validateLead,
} from "./commerce.js";

const appSource = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "app.ts"),
  "utf8",
);

beforeEach(() => {
  resetCommerceRateLimit();
});

describe("install-lead validation and mail body", () => {
  it("requires name and a real email, and treats website as a honeypot", () => {
    expect(validateLead(normalizeLead({ name: "Ada", email: "ada@example.com" }))).toBeNull();
    expect(validateLead(normalizeLead({ name: "", email: "ada@example.com" }))).toMatch(/name/);
    expect(validateLead(normalizeLead({ name: "Ada", email: "not-an-email" }))).toMatch(/email/);
    expect(
      normalizeLead({ name: "Bot", email: "bot@example.com", website: "https://spam.example" })
        .website.length,
    ).toBeGreaterThan(0);
  });

  it("addresses the real Kodros inbox and sets reply-to to the lead", () => {
    const email = buildLeadEmail({
      name: "Ada Lovelace",
      email: "ada@example.com",
      company: "Analytical Engines",
      notes: "Want a founding install",
    });
    expect(email.from).toBe("Kodros <contact@meshvault.ai>");
    expect(email.to).toEqual(["tanner@kodros.ai"]);
    expect(email.reply_to).toBe("ada@example.com");
    expect(email.subject).toMatch(/Ada Lovelace/);
    expect(email.text).toMatch(/Analytical Engines/);
    expect(INSTALL_LEAD.inbox).toBe("tanner@kodros.ai");
  });
});

describe("POST /api/install-lead", () => {
  it("emails tanner@kodros.ai and does not invent an inbox", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("https://api.resend.com/emails");
      const body = JSON.parse(String(init?.body));
      expect(body.to).toEqual(["tanner@kodros.ai"]);
      expect(body.reply_to).toBe("ada@example.com");
      return Response.json({ id: "re_test_msg_1" });
    });

    const res = await handleInstallLead(
      new Request("http://127.0.0.1:3100/api/install-lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Ada Lovelace",
          email: "ada@example.com",
          company: "Analytical Engines",
          notes: "Founding install",
        }),
      }),
      { env: { RESEND_API_KEY: "re_test_dry_run_key" }, fetchImpl },
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      ok: true,
      inbox: "tanner@kodros.ai",
      emailId: "re_test_msg_1",
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("returns 503 with the real inbox when Resend is not configured", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("must not call Resend");
    });
    const res = await handleInstallLead(
      new Request("http://127.0.0.1:3100/api/install-lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Ada", email: "ada@example.com" }),
      }),
      { env: {}, fetchImpl },
    );
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({
      error: "mailer_not_configured",
      contact: "tanner@kodros.ai",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects a missing email and swallows honeypot submissions", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ id: "should_not_send" }));
    const deps = { env: { RESEND_API_KEY: "re_test_dry_run_key" }, fetchImpl };

    const bad = await handleInstallLead(
      new Request("http://127.0.0.1:3100/api/install-lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Ada" }),
      }),
      deps,
    );
    expect(bad.status).toBe(400);
    await expect(bad.json()).resolves.toMatchObject({ error: "invalid_lead" });

    const bait = await handleInstallLead(
      new Request("http://127.0.0.1:3100/api/install-lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Bot",
          email: "bot@example.com",
          website: "https://spam.example",
        }),
      }),
      deps,
    );
    expect(bait.status).toBe(200);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("API mounts the lead route and no checkout route", () => {
  it("registers install-lead and has no create-checkout route", () => {
    expect(appSource).toContain('app.all("/api/install-lead"');
    expect(appSource).toContain("handleInstallLead");
    expect(appSource).not.toContain("create-checkout");
    expect(appSource).not.toContain("handleCreateCheckout");
  });
});
