import { describe, expect, it } from "vitest";
import {
  DEFAULT_ACTION_POLICY,
  evaluateActionPolicy,
  evaluateExpression,
  loadActionPolicy,
  type PolicyContext,
  parseActionPolicy,
} from "./policy.js";

const context: PolicyContext = {
  tool: { name: "shell" },
  bot: { id: "bot_1" },
  actor: { id: "user_1" },
  page: { url: "", host: "" },
  repeat: { count: 1 },
  control: { holder: "bot" },
  intent: "write",
};

describe("fail-closed action policy", () => {
  it("permits nothing when policy is missing", () => {
    const decision = evaluateActionPolicy(undefined, context);
    expect(decision.allowed).toBe(false);
    expect(decision.forward).toBe(false);
    expect(decision.source).toBe("default");
  });

  it("permits nothing when allow is empty", () => {
    const decision = evaluateActionPolicy({ mode: "enforce", deny: [], allow: [] }, context);
    expect(decision.forward).toBe(false);
    expect(decision.source).toBe("default");
  });

  it("evaluates deny before allow", () => {
    const decision = evaluateActionPolicy(
      { mode: "enforce", deny: ['tool.name == "shell"'], allow: ["true"] },
      context,
    );
    expect(decision.allowed).toBe(false);
    expect(decision.forward).toBe(false);
    expect(decision.source).toBe("deny");
    expect(decision.matched).toBe('tool.name == "shell"');
    expect(decision.reason).toContain('`tool.name == "shell"`');
  });

  it("treats a broken deny as a refusal", () => {
    const decision = evaluateActionPolicy(
      { mode: "enforce", deny: ["not a valid ("], allow: ["true"] },
      context,
    );
    expect(decision.forward).toBe(false);
    expect(decision.source).toBe("deny");
  });

  it("does not permit a broken allow", () => {
    const decision = evaluateActionPolicy(
      { mode: "enforce", deny: [], allow: ["not a valid ("] },
      context,
    );
    expect(decision.allowed).toBe(false);
    expect(decision.source).toBe("default");
  });

  it("records a dry-run deny without blocking the action", () => {
    const decision = evaluateActionPolicy({ mode: "dry-run", deny: ["true"], allow: [] }, context);
    expect(decision.allowed).toBe(false);
    expect(decision.forward).toBe(true);
  });

  it("ships an explicit allow-all default so existing bots keep working", () => {
    expect(DEFAULT_ACTION_POLICY).toEqual({ mode: "enforce", deny: [], allow: ["true"] });
    expect(evaluateActionPolicy(DEFAULT_ACTION_POLICY, context).forward).toBe(true);
    expect(loadActionPolicy({})).toEqual(DEFAULT_ACTION_POLICY);
  });

  it("refuses a malformed configured policy instead of opening", () => {
    expect(() => parseActionPolicy("{")).toThrow(/JSON/);
    expect(() => parseActionPolicy(JSON.stringify({ mode: "enforce" }))).toThrow(/allow/);
  });
});

describe("policy expressions", () => {
  it("matches fields, contains, and boolean combinations", () => {
    expect(evaluateExpression('tool.name == "shell" && intent == "write"', context)).toBe(true);
    expect(evaluateExpression('contains(tool.name, "SH")', context)).toBe(true);
    expect(evaluateExpression("repeat.count >= 10", context)).toBe(false);
    expect(evaluateExpression('tool.name == "write_file" || false', context)).toBe(false);
  });

  it("evaluates both operands of && and || regardless of the left side", () => {
    // A truthy left operand used to short-circuit `||` and a falsy left
    // operand used to short-circuit `&&`, leaving tokens unconsumed so the
    // whole expression threw "unexpected tokens in policy expression".
    expect(evaluateExpression("true || false", context)).toBe(true);
    expect(evaluateExpression("true || true", context)).toBe(true);
    expect(evaluateExpression("false && true", context)).toBe(false);
    expect(evaluateExpression("false && false", context)).toBe(false);
    expect(evaluateExpression('true || tool.name == "shell"', context)).toBe(true);
    expect(evaluateExpression('false && tool.name == "shell"', context)).toBe(false);
  });

  it("permits an action whose allow rule is decided by the left operand", () => {
    const decision = evaluateActionPolicy(
      { mode: "enforce", deny: [], allow: ['repeat.count > 5 || tool.name == "shell"'] },
      context,
    );
    expect(decision.allowed).toBe(true);
    expect(decision.source).toBe("allow");
  });
});
