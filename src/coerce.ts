import {
  ZodArray,
  ZodBoolean,
  ZodDefault,
  ZodEnum,
  ZodNumber,
  ZodObject,
  ZodOptional,
  ZodString,
  ZodUnion,
  type ZodRawShape,
  type ZodTypeAny
} from "zod";

import type { SchemaShape, StandardSchemaV1 } from "./standard-schema";

export type CoercionHint =
  | { type: "string" }
  | { type: "number" }
  | { type: "boolean" }
  | { type: "enum" }
  | { type: "array"; element: CoercionHint }
  | { type: "union"; options: CoercionHint[] }
  | { type: "fallback" }
  | { type: "unknown" };

function coerceBoolean(value: string): boolean | string {
  const normalized = value.trim().toLowerCase();

  if (normalized === "true" || normalized === "1" || normalized === "yes") {
    return true;
  }

  if (normalized === "false" || normalized === "0" || normalized === "no") {
    return false;
  }

  return value;
}

function coerceNumber(value: string): number | string {
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? value : parsed;
}

function coerceArray(value: string, elementHint: CoercionHint): unknown[] {
  if (value.trim() === "") {
    return [];
  }

  return value.split(",").map((item) => coerceValue(item.trim(), elementHint));
}

function tryCoerceValue(value: string, hint: CoercionHint): { success: boolean; value: unknown } {
  switch (hint.type) {
    case "string":
    case "enum":
      return { success: true, value };
    case "unknown":
      return { success: false, value };
    case "number": {
      const coerced = coerceNumber(value);
      return {
        success: typeof coerced === "number",
        value: coerced
      };
    }
    case "boolean": {
      const coerced = coerceBoolean(value);
      return {
        success: typeof coerced === "boolean",
        value: coerced
      };
    }
    case "array":
      return {
        success: true,
        value: coerceArray(value, hint.element)
      };
    case "union": {
      for (const option of hint.options) {
        const result = tryCoerceValue(value, option);

        if (result.success) {
          return result;
        }
      }

      return { success: false, value };
    }
    case "fallback":
      return tryCoerceValue(value, {
        type: "union",
        options: [
          { type: "number" },
          { type: "boolean" },
          { type: "array", element: { type: "string" } },
          { type: "string" }
        ]
      });
  }
}

export function coerceValue(value: string, hint: CoercionHint): unknown {
  return tryCoerceValue(value, hint).value;
}

export function inferCoercionHint(schema: ZodTypeAny): CoercionHint {
  if (schema instanceof ZodOptional || schema instanceof ZodDefault) {
    return inferCoercionHint(schema._def.innerType);
  }

  if (schema instanceof ZodString) {
    return { type: "string" };
  }

  if (schema instanceof ZodNumber) {
    return { type: "number" };
  }

  if (schema instanceof ZodBoolean) {
    return { type: "boolean" };
  }

  if (schema instanceof ZodEnum) {
    return { type: "enum" };
  }

  if (schema instanceof ZodArray) {
    return {
      type: "array",
      element: inferCoercionHint(schema._def.type)
    };
  }

  if (schema instanceof ZodUnion) {
    return {
      type: "union",
      options: schema._def.options.map((option) => inferCoercionHint(option))
    };
  }

  return { type: "unknown" };
}

function isZodSchema(value: StandardSchemaV1): value is ZodTypeAny {
  return value instanceof ZodString || value instanceof ZodNumber || value instanceof ZodBoolean || value instanceof ZodArray || value instanceof ZodEnum || value instanceof ZodOptional || value instanceof ZodDefault || value instanceof ZodUnion || value instanceof ZodObject;
}

export function inferCoercionHints(schema: ZodObject<any> | SchemaShape | ZodRawShape): Record<string, CoercionHint> {
  const shape = schema instanceof ZodObject ? schema.shape : schema;

  return Object.fromEntries(
    Object.entries(shape).map(([key, value]) => [
      key,
      isZodSchema(value as StandardSchemaV1)
        ? inferCoercionHint(value as ZodTypeAny)
        : { type: "fallback" }
    ])
  );
}
