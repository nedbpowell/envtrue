import { createEnv, type CreateEnvOptions, type EnvSource } from "../index";
import type { SchemaShape } from "../standard-schema";

type ViteImportMeta = {
  env?: Record<string, string | boolean | undefined>;
};

type ViteEnvOptions<TServer extends SchemaShape, TClient extends SchemaShape> = Omit<
  CreateEnvOptions<TServer, TClient>,
  "clientPrefix" | "env"
> & {
  env?: EnvSource;
};

function getImportMetaEnv(): EnvSource | undefined {
  const meta = import.meta as ImportMeta & ViteImportMeta;

  if (!meta.env) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(meta.env).map(([key, value]) => [key, value === undefined ? undefined : String(value)])
  );
}

export function createViteEnv<
  TServer extends SchemaShape,
  TClient extends SchemaShape
>(options: ViteEnvOptions<TServer, TClient>) {
  const env =
    options.env ??
    getImportMetaEnv() ??
    (typeof process !== "undefined" ? process.env : {});

  return createEnv({
    ...options,
    env,
    clientPrefix: "VITE_"
  });
}
