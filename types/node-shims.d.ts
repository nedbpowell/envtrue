declare module "node:fs" {
  export function existsSync(path: string): boolean;
  export function readFileSync(path: string, encoding: string): string;
  export function mkdtempSync(prefix: string): string;
  export function rmSync(
    path: string,
    options?: { recursive?: boolean; force?: boolean }
  ): void;
  export function writeFileSync(path: string, data: string): void;
}

declare module "node:path" {
  export function join(...paths: string[]): string;
  export function resolve(...paths: string[]): string;
}

declare module "node:os" {
  export function tmpdir(): string;
}

declare global {
  interface ImportMeta {
    env?: Record<string, string | boolean | undefined>;
  }

  var process:
    | {
        env: Record<string, string | undefined>;
        cwd(): string;
      }
    | undefined;

  var window: unknown;
}

export {};
