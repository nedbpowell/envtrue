import { describe, expect, it } from "vitest";
import * as v from "valibot";
import { z } from "zod";

import { coerceValue, inferCoercionHint, inferCoercionHints } from "../index";

describe("coerceValue", () => {
  it("coerces numbers including negatives", () => {
    expect(coerceValue("3000", { type: "number" })).toBe(3000);
    expect(coerceValue("-42.5", { type: "number" })).toBe(-42.5);
  });

  it("falls back to the original string when number coercion fails", () => {
    expect(coerceValue("", { type: "number" })).toBe("");
    expect(coerceValue("port", { type: "number" })).toBe("port");
  });

  it("coerces booleans including zero-like values", () => {
    expect(coerceValue("true", { type: "boolean" })).toBe(true);
    expect(coerceValue("1", { type: "boolean" })).toBe(true);
    expect(coerceValue("yes", { type: "boolean" })).toBe(true);
    expect(coerceValue("false", { type: "boolean" })).toBe(false);
    expect(coerceValue("0", { type: "boolean" })).toBe(false);
    expect(coerceValue("no", { type: "boolean" })).toBe(false);
  });

  it("falls back to the original string for unknown boolean tokens", () => {
    expect(coerceValue("", { type: "boolean" })).toBe("");
    expect(coerceValue("maybe", { type: "boolean" })).toBe("maybe");
  });

  it("passes through strings and enums unchanged", () => {
    expect(coerceValue("hello", { type: "string" })).toBe("hello");
    expect(coerceValue("production", { type: "enum" })).toBe("production");
  });

  it("coerces comma-separated arrays", () => {
    expect(
      coerceValue("a,b,c", {
        type: "array",
        element: { type: "string" }
      })
    ).toEqual(["a", "b", "c"]);

    expect(
      coerceValue("1, 2, -3.5", {
        type: "array",
        element: { type: "number" }
      })
    ).toEqual([1, 2, -3.5]);
  });

  it("returns an empty array for an empty string array input", () => {
    expect(
      coerceValue("", {
        type: "array",
        element: { type: "string" }
      })
    ).toEqual([]);
  });

  it("tries union coercion options in order", () => {
    expect(
      coerceValue("0", {
        type: "union",
        options: [{ type: "boolean" }, { type: "number" }]
      })
    ).toBe(false);

    expect(
      coerceValue("-7", {
        type: "union",
        options: [{ type: "boolean" }, { type: "number" }]
      })
    ).toBe(-7);

    expect(
      coerceValue("hello", {
        type: "union",
        options: [{ type: "number" }, { type: "string" }]
      })
    ).toBe("hello");

    expect(
      coerceValue("123", {
        type: "union",
        options: [{ type: "string" }, { type: "number" }]
      })
    ).toBe("123");
  });
});

describe("inferCoercionHint", () => {
  it("unwraps optional and default schemas", () => {
    expect(inferCoercionHint(z.number().optional())).toEqual({ type: "number" });
    expect(inferCoercionHint(z.boolean().default(false))).toEqual({ type: "boolean" });
  });
});

describe("inferCoercionHints", () => {
  it("infers coercion hints for a Zod object shape", () => {
    const schema = z.object({
      PORT: z.number(),
      DEBUG: z.boolean(),
      TAGS: z.array(z.string()),
      MODE: z.enum(["development", "production"]),
      TIMEOUT: z.number().optional(),
      FEATURE_ENABLED: z.boolean().default(false),
      FLEX: z.union([z.boolean(), z.number(), z.string()])
    });

    expect(inferCoercionHints(schema)).toEqual({
      PORT: { type: "number" },
      DEBUG: { type: "boolean" },
      TAGS: { type: "array", element: { type: "string" } },
      MODE: { type: "enum" },
      TIMEOUT: { type: "number" },
      FEATURE_ENABLED: { type: "boolean" },
      FLEX: {
        type: "union",
        options: [{ type: "boolean" }, { type: "number" }, { type: "string" }]
      }
    });
  });

  it("falls back to generic coercion hints for Standard Schema libraries without Zod introspection", () => {
    expect(
      inferCoercionHints({
        PORT: v.number(),
        ENABLED: v.boolean(),
        TAGS: v.array(v.string())
      })
    ).toEqual({
      PORT: { type: "fallback" },
      ENABLED: { type: "fallback" },
      TAGS: { type: "fallback" }
    });
  });
});
