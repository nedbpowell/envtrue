import { describe, expect, it } from "vitest";
import { z } from "zod";

import { createHonoEnv } from "../hono";
import { createNextEnv } from "../nextjs";
import { createViteEnv } from "../vite";

describe("adapters", () => {
  it("createNextEnv applies the NEXT_PUBLIC_ prefix", () => {
    const env = createNextEnv({
      env: {
        NEXT_PUBLIC_SITE_NAME: "typeenv"
      },
      client: {
        SITE_NAME: z.string()
      }
    });

    expect(env).toEqual({
      SITE_NAME: "typeenv"
    });
  });

  it("createNextEnv skips validation during Next build phases", () => {
    const env = createNextEnv({
      env: {
        NEXT_PHASE: "phase-production-build",
        PORT: "abc"
      },
      server: {
        PORT: z.number()
      }
    });

    expect(env).toEqual({
      PORT: "abc"
    });
  });

  it("createViteEnv applies the VITE_ prefix and env override", () => {
    const env = createViteEnv({
      env: {
        VITE_PORT: "5173"
      },
      client: {
        PORT: z.number()
      }
    });

    expect(env).toEqual({
      PORT: 5173
    });
  });

  it("createHonoEnv validates against an explicit env override", () => {
    const env = createHonoEnv({
      env: {
        API_KEY: "secret"
      },
      server: {
        API_KEY: z.string()
      }
    });

    expect(env).toEqual({
      API_KEY: "secret"
    });
  });
});
