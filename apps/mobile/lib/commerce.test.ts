import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  INSTALL_INBOX,
  INSTALL_LEAD_PATH,
  leadErrorMessage,
  submitInstallLead,
} from "./commerce.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(dir, "../app");

function screen(name: string) {
  return readFileSync(path.join(appDir, name), "utf8");
}

function mobileAppSources() {
  return [
    "_layout.tsx",
    "index.tsx",
    "sign-in.tsx",
    "founding.tsx",
    "new.tsx",
    "thread.tsx",
    "computer.tsx",
  ]
    .map(screen)
    .join("\n");
}

describe("founding screen is a visible pre-release path", () => {
  it("sign-in and inbox expose the founding route", () => {
    const signIn = screen("sign-in.tsx");
    const inbox = screen("index.tsx");
    const layout = screen("_layout.tsx");
    expect(signIn).toContain('"/founding"');
    expect(signIn).toContain("Pre-release and founding install");
    expect(inbox).toContain('"/founding"');
    expect(inbox).toContain("Founding install");
    expect(layout).toContain('name="founding"');
  });

  it("posts the lead form to the API origin and has no purchase control", () => {
    const founding = screen("founding.tsx");
    expect(founding).toContain("Request a founding install");
    expect(founding).toContain("submitInstallLead");
    expect(founding).toContain("currentApiBase");
    expect(founding).not.toMatch(/\$49|Buy the|checkout|Stripe/i);
    expect(founding).toMatch(/name/i);
    expect(founding).toMatch(/email/i);
    expect(founding).toMatch(/company/i);
    expect(founding).toMatch(/notes/i);
    expect(founding).toContain(INSTALL_INBOX);
    expect(founding).toMatch(/iOS is pre-release/);
    expect(founding).toMatch(/no App Store or TestFlight download yet/);
  });

  it("does not add, enable, or label an App Store / TestFlight download control", () => {
    const sources = mobileAppSources();
    expect(screen("founding.tsx")).toMatch(/no App Store or TestFlight download yet/);
    expect(sources).not.toMatch(/Download on iPhone/i);
    expect(sources).not.toMatch(/Download on the App Store/i);
    expect(sources).not.toMatch(/apps\.apple\.com/i);
    expect(sources).not.toMatch(/itms-beta/i);
    expect(sources).not.toMatch(/accessibilityLabel=["'][^"']*(Download|App Store|TestFlight)/);
    expect(sources).not.toMatch(/href=["'][^"']*(apps\.apple\.com|testflight)/i);
  });
});

describe("install-lead form client", () => {
  it("POSTs JSON to /api/install-lead and reports a missing mailer honestly", async () => {
    const calls: { input: string; init?: RequestInit }[] = [];
    const result = await submitInstallLead(
      "http://127.0.0.1:3100",
      { name: "Ada", email: "ada@example.com", company: "AE", notes: "hi" },
      {
        fetchImpl: async (input, init) => {
          calls.push({ input: String(input), init });
          return Response.json({ ok: true, inbox: INSTALL_INBOX });
        },
      },
    );
    expect(result.ok).toBe(true);
    expect(calls[0]?.input).toBe(`http://127.0.0.1:3100${INSTALL_LEAD_PATH}`);
    expect(calls[0]?.init?.method).toBe("POST");
    expect(JSON.parse(String(calls[0]?.init?.body)).email).toBe("ada@example.com");
    expect(leadErrorMessage(503, { error: "mailer_not_configured" })).toMatch(/tanner@kodros\.ai/);
  });

  it("does not treat a 503 as a sent lead", async () => {
    await expect(
      submitInstallLead(
        "http://127.0.0.1:3100",
        { name: "Ada", email: "ada@example.com" },
        {
          fetchImpl: async () =>
            new Response(
              JSON.stringify({
                error: "mailer_not_configured",
                contact: INSTALL_INBOX,
              }),
              { status: 503 },
            ),
        },
      ),
    ).rejects.toThrow(/tanner@kodros\.ai/);
  });
});

describe("no skills-pack purchase on mobile", () => {
  it("has no commerce route, menu entry, or checkout client", () => {
    const sources = mobileAppSources();
    expect(sources).not.toMatch(/\$49|skills pack|Buy the|["']\/commerce["']|create-checkout/i);
    expect(screen("_layout.tsx")).not.toContain('name="commerce"');
  });
});
