import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

describe("discord command registration", () => {
  test("registers a global Post message command", () => {
    const source = readFileSync(resolve(process.cwd(), "scripts/register-discord-command.ts"), "utf8");
    expect(source).toContain("/commands");
    expect(source).toContain('name: "Post"');
    expect(source).toContain("type: 3");
    expect(source).toContain("integration_types: [0]");
    expect(source).toContain("contexts: [0]");
  });
});
