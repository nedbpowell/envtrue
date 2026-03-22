import { createEnv, type CreateEnvOptions, type EnvSource } from "../index";
import type { SchemaShape } from "../standard-schema";

type HonoEnvOptions<TServer extends SchemaShape> = Omit<
  CreateEnvOptions<TServer, Record<string, never>>,
  "client" | "clientPrefix" | "env"
> & {
  env?: EnvSource;
};

export function createHonoEnv<TServer extends SchemaShape>(
  options: HonoEnvOptions<TServer>
) {
  return createEnv({
    ...options,
    env: options.env ?? (typeof process !== "undefined" ? process.env : {}),
    client: {}
  });
}
