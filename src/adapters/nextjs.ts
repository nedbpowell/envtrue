import { createEnv, type CreateEnvOptions, type EnvSource } from "../index";
import type { SchemaShape } from "../standard-schema";

type NextEnvOptions<TServer extends SchemaShape, TClient extends SchemaShape> = Omit<
  CreateEnvOptions<TServer, TClient>,
  "clientPrefix" | "env"
> & {
  env?: EnvSource;
};

function getNextPhase(env: EnvSource): string | undefined {
  return env.NEXT_PHASE;
}

function shouldSkipNextValidation(env: EnvSource): boolean {
  const phase = getNextPhase(env);
  return phase === "phase-production-build" || phase === "phase-export";
}

export function createNextEnv<
  TServer extends SchemaShape,
  TClient extends SchemaShape
>(options: NextEnvOptions<TServer, TClient>) {
  const env = options.env ?? (typeof process !== "undefined" ? process.env : {});

  return createEnv({
    ...options,
    env,
    clientPrefix: "NEXT_PUBLIC_",
    skipValidation: options.skipValidation ?? shouldSkipNextValidation(env)
  });
}
