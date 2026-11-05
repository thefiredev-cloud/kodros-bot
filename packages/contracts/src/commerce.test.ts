import { describe, expect, it, vi } from "vitest";
import {
  foundingInstallMailto,
  MESHVAULT_CONTACT_EMAIL,
  submitFoundingInstallLead,
  validateFoundingInstallLead,
} from "./commerce.js";

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

describe("founding install lead", () => {
  it("requires a name and a real email", () => {
    expect(validateFoundingInstallLead({ name: "", email: "ada@example.com" }).ok).toBe(false);
    expect(validateFoundingInstallLead({ name: "Ada", email: "not-an-email" }).ok).toBe(false);
    expect(
      validateFoundingInstallLead({ name: " Ada Lovelace ", email: "Ada@Example.com" }),
    ).toEqual({
      ok: true,
      lead: { name: "Ada Lovelace", email: "ada@example.com", company: "", notes: "" },
    });
  });

  it("submits name, email, company, and notes without a honeypot field", async () => {
    const fetchImpl = vi.fn(async (_input: string, init?: { body?: string }) => {
      expect(JSON.parse(init?.body ?? "{}")).toEqual({
        name: "Ada Lovelace",
        email: "ada@example.com",
        company: "Analytical Engines",
        notes: "Windows-owned runtime",
      });
      expect(init?.body).not.toContain("website");
      return jsonResponse({ ok: true, brand: "Kodros", inbox: MESHVAULT_CONTACT_EMAIL });
    });
    await expect(
      submitFoundingInstallLead(
        {
          name: "Ada Lovelace",
          email: "ada@example.com",
          company: "Analytical Engines",
          notes: "Windows-owned runtime",
        },
        fetchImpl,
      ),
    ).resolves.toEqual({ status: "submitted", inbox: MESHVAULT_CONTACT_EMAIL });
  });

  it("returns the contact inbox when the mailer is down or the browser cannot read the response", async () => {
    await expect(
      submitFoundingInstallLead({ name: "Ada", email: "ada@example.com" }, async () =>
        jsonResponse({
          error: "mailer_not_configured",
          message: "Email tanner@kodros.ai",
          contact: MESHVAULT_CONTACT_EMAIL,
        }),
      ),
    ).resolves.toMatchObject({ status: "contact", inbox: MESHVAULT_CONTACT_EMAIL });

    await expect(
      submitFoundingInstallLead({ name: "Ada", email: "ada@example.com" }, async () => {
        throw new TypeError("Failed to fetch");
      }),
    ).resolves.toMatchObject({ status: "contact", inbox: MESHVAULT_CONTACT_EMAIL });
  });

  it("builds a mailto fallback that names the founding-install inbox", () => {
    const href = foundingInstallMailto({ name: "Ada", email: "ada@example.com", notes: "DGX" });
    expect(href.startsWith(`mailto:${MESHVAULT_CONTACT_EMAIL}?`)).toBe(true);
    expect(decodeURIComponent(href)).toContain("Founding install lead: Ada");
    expect(decodeURIComponent(href)).toContain("DGX");
  });
});

describe("no purchase surface", () => {
  it("exports no checkout helpers", async () => {
    const mod = (await import("./commerce.js")) as Record<string, unknown>;
    expect(Object.keys(mod).filter((key) => /checkout|skill.?pack/i.test(key))).toEqual([]);
  });
});
