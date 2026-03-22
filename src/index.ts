import { z, type ZodIssue, type ZodRawShape } from "zod";

import { coerceValue, inferCoercionHints } from "./coerce";
import { loadDotEnvFiles } from "./parser";
import type { SchemaShape, StandardSchemaV1 } from "./standard-schema";

export interface EnvError {
  key: string;
  message: string;
  value?: string;
  source: "server" | "client";
}

export type EnvSource = Record<string, string | undefined>;

export type CreateEnvOptions<TServer extends AnySchemaShape, TClient extends AnySchemaShape> = {
  server?: TServer;
  client?: TClient;
  clientPrefix?: string;
  envFiles?: string | string[];
  cwd?: string;
  env?: EnvSource;
  skipValidation?: boolean;
  onError?: (errors: EnvError[]) => void;
};

type AnySchemaShape = SchemaShape;

type InferSchemaShape<TShape extends AnySchemaShape | undefined> =
  TShape extends ZodRawShape
    ? z.infer<z.ZodObject<TShape>>
    : TShape extends SchemaShape
      ? { [K in keyof TShape]: TShape[K] extends StandardSchemaV1<any, infer Output> ? Output : never }
      : {};

function getProcessEnv(): Record<string, string | undefined> {
  if (typeof process !== "undefined" && process.env) {
    return process.env;
  }

  return {};
}

function formatExpectedType(issue: ZodIssue): string | undefined {
  if (issue.code === "invalid_type") {
    return issue.expected;
  }

  if (issue.code === "invalid_string" && issue.validation === "url") {
    return "valid URL";
  }

  return undefined;
}

function formatIssueMessage(issue: ZodIssue, rawValue: string | undefined): string {
  if (issue.code === "invalid_type" && issue.received === "undefined") {
    return "Required";
  }

  const expectedType = formatExpectedType(issue);

  if (expectedType) {
    const received = rawValue === undefined ? "undefined" : JSON.stringify(rawValue);
    return `Expected ${expectedType}, received ${received}`;
  }

  return issue.message;
}

function formatErrors(errors: EnvError[]): string {
  const lines = errors.map((error) => `  ${error.key}: ${error.message}`);
  return ["❌ typeenv: Invalid environment variables:", ...lines].join("\n");
}

function isZodShape(shape: AnySchemaShape): shape is ZodRawShape {
  return Object.values(shape).every((value) => value instanceof z.ZodType);
}

function collectSchemaInput(
  shape: AnySchemaShape,
  env: Record<string, string | undefined>,
  keyForEnv: (key: string) => string
): { input: Record<string, unknown>; rawValues: Record<string, string | undefined> } {
  const hints = inferCoercionHints(shape);
  const input: Record<string, unknown> = {};
  const rawValues: Record<string, string | undefined> = {};

  for (const [schemaKey, hint] of Object.entries(hints)) {
    const envKey = keyForEnv(schemaKey);
    const rawValue = env[envKey];

    rawValues[schemaKey] = rawValue;

    if (rawValue !== undefined) {
      input[schemaKey] = coerceValue(rawValue, hint);
    }
  }

  return { input, rawValues };
}

function getIssuePathKey(issue: { path?: ReadonlyArray<PropertyKey | { key: PropertyKey }> | undefined }): string {
  const segment = issue.path?.[0];

  if (typeof segment === "object" && segment !== null && "key" in segment) {
    return String(segment.key);
  }

  return String(segment ?? "");
}

function collectValidationErrors(
  source: "server" | "client",
  issues: ReadonlyArray<{ path?: ReadonlyArray<PropertyKey | { key: PropertyKey }> | undefined; message: string; code?: string; expected?: string; received?: string; validation?: string }>,
  rawValues: Record<string, string | undefined>,
  keyForEnv: (key: string) => string
): EnvError[] {
  return issues.map((issue) => {
    const schemaKey = getIssuePathKey(issue);
    const envKey = keyForEnv(schemaKey);
    const message =
      "code" in issue && issue.code
        ? formatIssueMessage(issue as ZodIssue, rawValues[schemaKey])
        : issue.message;

    return {
      key: envKey || "unknown",
      message,
      value: rawValues[schemaKey],
      source
    };
  });
}

function isPromiseLike<T>(value: T | Promise<T>): value is Promise<T> {
  return typeof value === "object" && value !== null && "then" in value;
}

function validateZodShape(
  shape: ZodRawShape,
  input: Record<string, unknown>
): { data: Record<string, unknown>; issues: ZodIssue[] } {
  const result = z.object(shape).safeParse(input);

  if (result.success) {
    return {
      data: result.data,
      issues: []
    };
  }

  return {
    data: {},
    issues: result.error.issues
  };
}

function validateStandardShape(
  shape: AnySchemaShape,
  input: Record<string, unknown>
): { data: Record<string, unknown>; issues: Array<{ path?: ReadonlyArray<PropertyKey | { key: PropertyKey }>; message: string }> } {
  const data: Record<string, unknown> = {};
  const issues: Array<{ path?: ReadonlyArray<PropertyKey | { key: PropertyKey }>; message: string }> = [];

  for (const [key, schema] of Object.entries(shape)) {
    const result = schema["~standard"].validate(input[key]);

    if (isPromiseLike(result)) {
      throw new Error("typeenv only supports synchronous Standard Schema validation.");
    }

    if (result.issues) {
      if (result.issues.length === 0) {
        continue;
      }

      for (const issue of result.issues) {
        issues.push({
          path: issue.path?.length ? issue.path : [key],
          message: issue.message
        });
      }

      continue;
    }

    data[key] = result.value;
  }

  return { data, issues };
}

function validateShape(
  shape: AnySchemaShape,
  input: Record<string, unknown>
): { data: Record<string, unknown>; issues: Array<{ path?: ReadonlyArray<PropertyKey | { key: PropertyKey }>; message: string; code?: string; expected?: string; received?: string; validation?: string }> } {
  if (isZodShape(shape)) {
    return validateZodShape(shape, input);
  }

  return validateStandardShape(shape, input);
}

export function createEnv<
  TServer extends AnySchemaShape,
  TClient extends AnySchemaShape
>(options: CreateEnvOptions<TServer, TClient>): Readonly<InferSchemaShape<TServer> & InferSchemaShape<TClient>> {
  const serverShape = (options.server ?? {}) as TServer;
  const clientShape = (options.client ?? {}) as TClient;
  const clientPrefix = options.clientPrefix ?? "NEXT_PUBLIC_";
  const envFiles = options.envFiles ?? [".env", ".env.local"];
  const cwd = options.cwd ?? (typeof process !== "undefined" ? process.cwd() : ".");
  const skipValidation = options.skipValidation ?? false;
  const runtimeEnv = options.env ?? getProcessEnv();
  const loadedEnv = loadDotEnvFiles({ cwd, path: envFiles });
  const mergedEnv = {
    ...loadedEnv,
    ...runtimeEnv
  };
  const isBrowser = typeof window !== "undefined";

  const serverInput = collectSchemaInput(serverShape, mergedEnv, (key) => key);
  const clientInput = collectSchemaInput(clientShape, mergedEnv, (key) => `${clientPrefix}${key}`);

  if (skipValidation) {
    return Object.freeze({
      ...(isBrowser ? {} : serverInput.input),
      ...clientInput.input
    }) as Readonly<InferSchemaShape<TServer> & InferSchemaShape<TClient>>;
  }

  const serverResult = isBrowser
    ? { data: {}, issues: [] as Array<{ path?: ReadonlyArray<PropertyKey | { key: PropertyKey }>; message: string }> }
    : validateShape(serverShape, serverInput.input);
  const clientResult = validateShape(clientShape, clientInput.input);
  const errors = [
    ...collectValidationErrors("server", serverResult.issues, serverInput.rawValues, (key) => key),
    ...collectValidationErrors("client", clientResult.issues, clientInput.rawValues, (key) => `${clientPrefix}${key}`)
  ];

  if (errors.length > 0) {
    const onError =
      options.onError ??
      ((issues: EnvError[]) => {
        throw new Error(formatErrors(issues));
      });

    onError(errors);
    // `onError` is a notification hook, not an error suppression hook.
    // We still throw the aggregated startup error unless the hook itself throws first.
    throw new Error(formatErrors(errors));
  }

  return Object.freeze({
    ...(isBrowser ? {} : serverResult.data),
    ...clientResult.data
  }) as Readonly<InferSchemaShape<TServer> & InferSchemaShape<TClient>>;
}
