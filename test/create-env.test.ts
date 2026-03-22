import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import * as v from "valibot";
import { z } from "zod";

import { createEnv, type EnvError } from "../index";

const ORIGINAL_ENV = { ...process.env };

function withTempDir(testFn: (cwd: string) => void): void {
  const cwd = mkdtempSync(join(tmpdir(), "envtrue-create-env-"));

  try {
    testFn(cwd);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  delete (globalThis as { window?: unknown }).window;
});

describe("createEnv", () => {
  it("loads files, merges process.env, coerces values, validates, and freezes the result", () => {
    withTempDir((cwd) => {
      writeFileSync(
        join(cwd, ".env"),
        [
          "DATABASE_URL=https://db.example.com",
          "PORT=3000",
          "ENABLED=yes",
          "NEXT_PUBLIC_FEATURES=a,b,c"
        ].join("\n")
      );

      process.env.PORT = "4000";

      const env = createEnv({
        cwd,
        server: {
          DATABASE_URL: z.string().url(),
          PORT: z.number(),
          ENABLED: z.boolean()
        },
        client: {
          FEATURES: z.array(z.string())
        }
      });

      expect(env).toEqual({
        DATABASE_URL: "https://db.example.com",
        PORT: 4000,
        ENABLED: true,
        FEATURES: ["a", "b", "c"]
      });
      expect(Object.isFrozen(env)).toBe(true);
    });
  });

  it("collects all missing required variables into one error", () => {
    withTempDir((cwd) => {
      expect(() =>
        createEnv({
          cwd,
          server: {
            DATABASE_URL: z.string().url(),
            API_KEY: z.string()
          }
        })
      ).toThrowError(
        '❌ envtrue: Invalid environment variables:\n  DATABASE_URL: Required\n  API_KEY: Required'
      );
    });
  });

  it("formats invalid values from server and client schemas together", () => {
    withTempDir((cwd) => {
      writeFileSync(
        join(cwd, ".env"),
        ["DATABASE_URL=localhost", "PORT=abc", "NEXT_PUBLIC_ENABLED=maybe"].join("\n")
      );

      expect(() =>
        createEnv({
          cwd,
          server: {
            DATABASE_URL: z.string().url(),
            PORT: z.number()
          },
          client: {
            ENABLED: z.boolean()
          }
        })
      ).toThrowError(
        '❌ envtrue: Invalid environment variables:\n  DATABASE_URL: Expected valid URL, received "localhost"\n  PORT: Expected number, received "abc"\n  NEXT_PUBLIC_ENABLED: Expected boolean, received "maybe"'
      );
    });
  });

  it("skips server validation in client-only mode", () => {
    withTempDir((cwd) => {
      writeFileSync(join(cwd, ".env"), "NEXT_PUBLIC_MODE=production\n");
      (globalThis as { window?: unknown }).window = {};

      const env = createEnv({
        cwd,
        server: {
          DATABASE_URL: z.string().url()
        },
        client: {
          MODE: z.enum(["development", "production"])
        }
      });

      expect(env).toEqual({
        MODE: "production"
      });
    });
  });

  it("supports a custom client prefix", () => {
    withTempDir((cwd) => {
      writeFileSync(join(cwd, ".env"), "PUBLIC_API_URL=https://example.com\n");

      const env = createEnv({
        cwd,
        clientPrefix: "PUBLIC_",
        client: {
          API_URL: z.string().url()
        }
      });

      expect(env).toEqual({
        API_URL: "https://example.com"
      });
    });
  });

  it("supports skipValidation while still applying coercion", () => {
    withTempDir((cwd) => {
      writeFileSync(join(cwd, ".env"), "PORT=abc\nNEXT_PUBLIC_FEATURES=a,b\n");

      const env = createEnv({
        cwd,
        skipValidation: true,
        server: {
          PORT: z.number()
        },
        client: {
          FEATURES: z.array(z.string())
        }
      });

      expect(env).toEqual({
        PORT: "abc",
        FEATURES: ["a", "b"]
      });
    });
  });

  it("supports custom env file paths", () => {
    withTempDir((cwd) => {
      writeFileSync(join(cwd, "config.env"), "PORT=8080\n");

      const env = createEnv({
        cwd,
        envFiles: "config.env",
        server: {
          PORT: z.number()
        }
      });

      expect(env).toEqual({
        PORT: 8080
      });
    });
  });

  it("supports Standard Schema libraries such as Valibot", () => {
    withTempDir((cwd) => {
      writeFileSync(
        join(cwd, ".env"),
        ["PORT=3001", "ENABLED=true", "NEXT_PUBLIC_TAGS=a,b,c"].join("\n")
      );

      const env = createEnv({
        cwd,
        server: {
          PORT: v.number(),
          ENABLED: v.boolean()
        },
        client: {
          TAGS: v.array(v.string())
        }
      });

      expect(env).toEqual({
        PORT: 3001,
        ENABLED: true,
        TAGS: ["a", "b", "c"]
      });
    });
  });

  it("collects Standard Schema validation errors", () => {
    withTempDir((cwd) => {
      writeFileSync(join(cwd, ".env"), "PORT=abc\n");

      expect(() =>
        createEnv({
          cwd,
          server: {
            PORT: v.number()
          }
        })
      ).toThrowError("❌ envtrue: Invalid environment variables:\n  PORT:");
    });
  });

  it("passes all collected errors to onError", () => {
    withTempDir((cwd) => {
      const received: EnvError[][] = [];

      expect(() =>
        createEnv({
          cwd,
          server: {
            PORT: z.number(),
            DATABASE_URL: z.string().url()
          },
          onError: (errors) => {
            received.push(errors);
          }
        })
      ).toThrowError();

      expect(received).toHaveLength(1);
      expect(received[0]).toEqual([
        {
          key: "PORT",
          message: "Required",
          source: "server",
          value: undefined
        },
        {
          key: "DATABASE_URL",
          message: "Required",
          source: "server",
          value: undefined
        }
      ]);
    });
  });
});
