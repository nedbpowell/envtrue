import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { loadDotEnvFiles, parseDotEnv } from "../index";

describe("parseDotEnv", () => {
  it("parses quoted and unquoted values", () => {
    const parsed = parseDotEnv(`
      FOO=bar
      SPACED =  hello world
      SINGLE='quoted value'
      DOUBLE="quoted value"
    `);

    expect(parsed).toEqual({
      FOO: "bar",
      SPACED: "hello world",
      SINGLE: "quoted value",
      DOUBLE: "quoted value"
    });
  });

  it("ignores empty lines and comment lines", () => {
    const parsed = parseDotEnv(`
      # comment

      FOO=bar
        # indented comment

      BAR=baz
    `);

    expect(parsed).toEqual({
      FOO: "bar",
      BAR: "baz"
    });
  });

  it("supports multiline double-quoted values", () => {
    const parsed = parseDotEnv('PRIVATE_KEY="line-1\nline-2\nline-3"\nMODE=test');

    expect(parsed).toEqual({
      PRIVATE_KEY: "line-1\nline-2\nline-3",
      MODE: "test"
    });
  });

  it("expands variables from previously parsed values", () => {
    const parsed = parseDotEnv(`
      HOST=https://example.com
      DATABASE_URL=$HOST/mydb
      API_URL="$DATABASE_URL/api"
    `);

    expect(parsed).toEqual({
      HOST: "https://example.com",
      DATABASE_URL: "https://example.com/mydb",
      API_URL: "https://example.com/mydb/api"
    });
  });
});

describe("loadDotEnvFiles", () => {
  it("returns an empty object when files are missing", () => {
    const cwd = mkdtempSync(join(tmpdir(), "typeenv-missing-"));

    try {
      expect(loadDotEnvFiles({ cwd })).toEqual({});
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("loads .env then lets .env.local take precedence", () => {
    const cwd = mkdtempSync(join(tmpdir(), "typeenv-default-"));

    try {
      writeFileSync(join(cwd, ".env"), "FOO=base\nBAR=shared\n");
      writeFileSync(join(cwd, ".env.local"), "BAR=local\nBAZ=extra\n");

      expect(loadDotEnvFiles({ cwd })).toEqual({
        FOO: "base",
        BAR: "local",
        BAZ: "extra"
      });
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("supports custom paths", () => {
    const cwd = mkdtempSync(join(tmpdir(), "typeenv-custom-"));

    try {
      writeFileSync(join(cwd, "custom.env"), "FOO=custom\n");
      writeFileSync(join(cwd, "custom.local.env"), "BAR=local\nFOO=override\n");

      expect(
        loadDotEnvFiles({
          cwd,
          path: ["custom.env", "custom.local.env"]
        })
      ).toEqual({
        FOO: "override",
        BAR: "local"
      });
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
