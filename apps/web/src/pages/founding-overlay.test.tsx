import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FoundingPanel } from "./FoundingOverlay.js";

describe("founding panel", () => {
  it("offers a founding-install lead, no purchase, and does not claim released clients", () => {
    const html = renderToStaticMarkup(<FoundingPanel />);
    expect(html).not.toMatch(/\$49|Buy the|checkout|Stripe|skills pack/i);
    expect(html).toContain("Request a founding install");
    expect(html).toContain("Apache-2.0");
    expect(html).toContain("self-hosted");
    expect(html).toMatch(/in development and are not released/);
    expect(html).not.toMatch(/App Store|Mac App Store|TestFlight/);
  });
});
