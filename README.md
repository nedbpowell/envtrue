# envtrue

Type-safe environment variables. Loads `.env` files, validates with Zod/Valibot/ArkType, auto-coerces types. Drop-in dotenv replacement.

[![npm version](https://img.shields.io/npm/v/envtrue)](https://www.npmjs.com/package/envtrue)
[![npm downloads](https://img.shields.io/npm/dw/envtrue)](https://www.npmjs.com/package/envtrue)
[![license](https://img.shields.io/npm/l/envtrue)](./LICENSE)

## The problem

- `process.env` is `string | undefined`, so you lose types immediately.
- Missing or malformed variables fail at runtime, often far away from startup.
- Client bundles can accidentally expose server secrets if env handling is ad hoc.

## Install

```bash
npm install envtrue zod
```

```bash
pnpm add envtrue zod
```

```bash
yarn add envtrue zod
```

## Quick start

```ts
import { createEnv } from "envtrue";
import { z } from "zod";

const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    PORT: z.number(),        // auto-coerced from "3000" → 3000
    API_KEY: z.string().min(1),
  },
  client: {
    API_BASE: z.string().url(),
  },
  clientPrefix: "NEXT_PUBLIC_"
});

const db: string = env.DATABASE_URL;  // typed as string
await connect(db, { port: env.PORT }); // typed as number
fetch(env.API_BASE);
```

## Why not t3-env?

| Feature | `envtrue` | `t3-env` |
| --- | --- | --- |
| Loads `.env` files for you | ✅ | ❌ |
| Auto-coerces `z.number()`, `z.boolean()`, `z.array()` | ✅ | ❌ |
| No `runtimeEnv` boilerplate | ✅ | ❌ |
| Framework-agnostic core | ✅ | ⚠️ |

`envtrue` is optimized for the common case: read `.env`, merge with runtime env, coerce strings into the right primitives, validate once, return typed values. No extra runtime mapping step.

## Why not the DIY Zod pattern?

The usual Zod setup is a small pile of repeated glue:

- Load `.env` yourself
- Merge sources manually
- Remember to coerce strings before validation
- Split public and private variables by convention
- Build readable startup errors yourself

`envtrue` keeps the schema but removes the glue. It auto-loads `.env` and `.env.local`, auto-coerces string inputs, separates client variables by prefix, and throws one formatted error with every invalid variable listed at once.

## Framework adapters

| Adapter | Import | Notes |
| --- | --- | --- |
| Next.js | `import { createNextEnv } from "envtrue/nextjs"` | Uses `NEXT_PUBLIC_`, skips server validation in browser bundles, skips validation during Next build phases when needed |
| Vite | `import { createViteEnv } from "envtrue/vite"` | Uses `VITE_`, works with `import.meta.env` or `process.env` |
| Hono | `import { createHonoEnv } from "envtrue/hono"` | Server-only, supports explicit `env` bindings such as Cloudflare Workers / `c.env` |

## API reference

### `createEnv(options)`

```ts
createEnv({
  server,
  client,
  clientPrefix,
  envFiles,
  cwd,
  env,
  skipValidation,
  onError
})
```

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `server` | `SchemaShape` | `{}` | Server-only environment schema |
| `client` | `SchemaShape` | `{}` | Client-safe environment schema |
| `clientPrefix` | `string` | `"NEXT_PUBLIC_"` | Prefix required for client variables |
| `envFiles` | `string \| string[]` | `[".env", ".env.local"]` | `.env` files to load, in merge order |
| `cwd` | `string` | `process.cwd()` | Base directory used to resolve `envFiles` |
| `env` | `Record<string, string \| undefined>` | `process.env` | Explicit runtime env source override |
| `skipValidation` | `boolean` | `false` | Skip schema validation and return coerced raw values |
| `onError` | `(errors: EnvError[]) => void` | throws formatted error | Hook for custom error handling |

### Validation flow

1. Load `.env` files from disk.
2. Merge loaded values with runtime env. Runtime env wins.
3. Coerce string values before validation.
4. Validate server and client schemas.
5. Throw one aggregated error if anything is invalid.
6. Return a frozen typed object.

### Supported schemas

- Zod raw shapes
- Standard Schema compatible shapes (Valibot, ArkType)

ArkType is supported through Standard Schema compatibility, but is not currently covered by the test suite.

## Roadmap

- [ ] Monorepo support
- [ ] Encrypted `.env` support with `dotenvx` compatibility
- [ ] VS Code extension for `.env` autocomplete and intellisense

## License

MIT