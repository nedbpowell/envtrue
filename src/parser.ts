import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const VARIABLE_PATTERN = /\$([A-Za-z_][A-Za-z0-9_]*)/g;

function getRuntimeEnv(): Record<string, string | undefined> {
  if (typeof process !== "undefined" && process.env) {
    return process.env;
  }

  return {};
}

function expandVariables(value: string, env: Record<string, string>): string {
  const runtimeEnv = getRuntimeEnv();

  return value.replace(VARIABLE_PATTERN, (_, name: string) => {
    if (Object.prototype.hasOwnProperty.call(env, name)) {
      return env[name];
    }

    return runtimeEnv[name] ?? "";
  });
}

function parseDoubleQuotedValue(
  source: string,
  startIndex: number
): { value: string; nextIndex: number } {
  let value = "";
  let index = startIndex + 1;

  while (index < source.length) {
    const char = source[index];

    if (char === '"' && source[index - 1] !== "\\") {
      return {
        value: value.replace(/\\"/g, '"'),
        nextIndex: index + 1
      };
    }

    value += char;
    index += 1;
  }

  return {
    value: value.replace(/\\"/g, '"'),
    nextIndex: source.length
  };
}

function nextLineIndex(source: string, startIndex: number): number {
  const newlineIndex = source.indexOf("\n", startIndex);
  return newlineIndex === -1 ? source.length : newlineIndex + 1;
}

export function parseDotEnv(content: string): Record<string, string> {
  const parsed: Record<string, string> = {};
  let index = 0;

  while (index < content.length) {
    const lineEnd = content.indexOf("\n", index);
    const nextIndex = lineEnd === -1 ? content.length : lineEnd + 1;
    const rawLine = content.slice(index, lineEnd === -1 ? content.length : lineEnd);
    const line = rawLine.replace(/\r$/, "");
    const trimmed = line.trim();

    if (trimmed === "" || trimmed.startsWith("#")) {
      index = nextIndex;
      continue;
    }

    const equalsIndex = line.indexOf("=");
    if (equalsIndex === -1) {
      index = nextIndex;
      continue;
    }

    const key = line.slice(0, equalsIndex).trim();
    if (key === "") {
      index = nextIndex;
      continue;
    }

    let valueSource = line.slice(equalsIndex + 1);
    let value = "";

    if (valueSource.trimStart().startsWith('"')) {
      const quoteOffset = valueSource.indexOf('"');
      const quoteStart = index + equalsIndex + 1 + quoteOffset;
      const parsedValue = parseDoubleQuotedValue(content, quoteStart);
      value = expandVariables(parsedValue.value, parsed);
      index = nextLineIndex(content, parsedValue.nextIndex);
      parsed[key] = value;
      continue;
    }

    valueSource = valueSource.trim();

    if (valueSource.startsWith("'")) {
      const closingIndex = valueSource.indexOf("'", 1);
      value =
        closingIndex === -1
          ? valueSource.slice(1)
          : valueSource.slice(1, closingIndex);
    } else {
      const commentIndex = valueSource.indexOf(" #");
      const unquotedValue =
        commentIndex === -1 ? valueSource : valueSource.slice(0, commentIndex);
      value = expandVariables(unquotedValue.trim(), parsed);
    }

    parsed[key] = value;
    index = nextIndex;
  }

  return parsed;
}

export function loadDotEnvFiles(options: { path?: string | string[]; cwd?: string } = {}): Record<string, string> {
  const cwd = options.cwd ?? process.cwd();
  const paths = options.path
    ? (Array.isArray(options.path) ? options.path : [options.path]).map((filePath) => resolve(cwd, filePath))
    : [resolve(cwd, ".env"), resolve(cwd, ".env.local")];

  const loaded: Record<string, string> = {};

  for (const filePath of paths) {
    if (!existsSync(filePath)) {
      continue;
    }

    const parsed = parseDotEnv(readFileSync(filePath, "utf8"));
    Object.assign(loaded, parsed);
  }

  return loaded;
}
