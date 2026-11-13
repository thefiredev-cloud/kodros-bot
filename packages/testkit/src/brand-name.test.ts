import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { MESHVAULT_SELL } from "@meshbot/contracts";
import { describe, expect, it } from "vitest";

const leftoverPitch =
  /AI teammates you actually own|Private bots on computers you control|Open-source Grok Bot alternative|Open source alternative to Grok Bot/i;

const sellSurfaces = [
  "README.md",
  "PRODUCT.md",
  "docs/self-host.md",
  "apps/www/src/site.ts",
  "apps/www/src/pages/index.astro",
  "apps/www/src/layouts/BaseLayout.astro",
  "apps/www/public/site.webmanifest",
  "apps/web/index.html",
  "apps/web/public/site.webmanifest",
  "apps/web/src/pages/Welcome.tsx",
  "apps/web/src/pages/Auth.tsx",
  "apps/web/src/pages/Onboarding.tsx",
  "apps/web/src/pages/FoundingOverlay.tsx",
  "apps/web/src/pages/Shell.tsx",
  "apps/desktop/src/connect.html",
  "apps/desktop/src/main.ts",
  "apps/mobile/app/sign-in.tsx",
  "apps/mobile/app/founding.tsx",
  "apps/mobile/app/index.tsx",
  "packages/contracts/src/brand.ts",
];

const nameSurfaces = [
  ".github/ISSUE_TEMPLATE/bug.yml",
  ".github/ISSUE_TEMPLATE/self-host.yml",
  "apps/www/src/components/Logo.astro",
  "apps/desktop/package.json",
  "apps/mobile/app.json",
  "apps/mobile/app/_layout.tsx",
  "packages/ui-web/src/bot-avatar.tsx",
  "packages/auth/src/index.ts",
];

describe("Kodros sell", () => {
  it("locks the exact company offer", () => {
    expect(MESHVAULT_SELL).toBe(
      "Kodros is the model plus the application plus compute. That is the company, the offer, and the message.",
    );
  });

  it.each(sellSurfaces)("states the Kodros sell on %s", (file) => {
    const source = readFileSync(path.resolve(file), "utf8");
    expect(source.includes(MESHVAULT_SELL) || source.includes("MESHVAULT_SELL")).toBe(true);
    expect(source).not.toMatch(leftoverPitch);
    // README.md must name the upstream project: Apache-2.0 attribution for the fork.
    if (file !== "README.md") expect(source).not.toMatch(/\b(?:Rakazo|Razko)\b/);
  });

  it.each(nameSurfaces)("uses Kodros and not the old brand name on %s", (file) => {
    const source = readFileSync(path.resolve(file), "utf8");
    expect(source).toMatch(/\bKodros\b/);
    expect(source).not.toMatch(/\bMeshVault\b/);
    expect(source).not.toMatch(/\b(?:Rakazo|Razko|Kodros Bot)\b/i);
  });

  it.each(sellSurfaces)("shows no old brand name on %s", (file) => {
    const source = readFileSync(path.resolve(file), "utf8");
    expect(source).not.toMatch(/\bMeshVault\b/);
  });

  it("uses the current mobile origin scheme", () => {
    const source = ["apps/mobile/lib/api.ts", "apps/mobile/lib/endpoint.ts"]
      .map((file) => readFileSync(path.resolve(file), "utf8"))
      .join("\n");
    expect(source).toContain('origin: "meshbot://"');
    expect(source).not.toContain('origin: "meshvault://"');
  });
});

const purchasePattern =
  /\$49|skill[- ]?pack|skills pack|create-checkout|Buy the|api\.stripe\.com|STRIPE_/i;
const productRoots = [
  "apps/api/src",
  "apps/desktop/src",
  "apps/mobile/app",
  "apps/mobile/lib",
  "apps/web/src",
  "apps/www/src",
  "packages/contracts/src",
];

function productSources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return productSources(full);
    return /\.(tsx?|astro|html|js|cjs)$/.test(entry.name) && !/\.test\./.test(entry.name)
      ? [full]
      : [];
  });
}

describe("no skills-pack purchase", () => {
  it("removed the buy screens and checkout files", () => {
    for (const file of [
      "apps/mobile/app/commerce.tsx",
      "apps/web/src/pages/CommerceOverlay.tsx",
      "apps/web/src/pages/commerce-overlay.test.tsx",
    ]) {
      expect(existsSync(path.resolve(file)), file).toBe(false);
    }
  });

  it.each(productRoots)("has no purchase copy, checkout route, or Stripe call under %s", (root) => {
    for (const file of productSources(path.resolve(root))) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(purchasePattern);
    }
  });

  it("has no checkout env keys in .env.example", () => {
    expect(readFileSync(path.resolve(".env.example"), "utf8")).not.toMatch(
      /STRIPE_|CHECKOUT|SKILLS_PAYMENT_LINK/,
    );
  });
});
