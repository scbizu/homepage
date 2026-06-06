import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const root = process.cwd();
const contentPath = resolve(root, "src/content/homepage.ts");
const annotatedLinePath = resolve(root, "src/components/AnnotatedLine.astro");
const textEntryPath = resolve(root, "src/components/TextEntry.astro");
const imageEntryPath = resolve(root, "src/components/ImageEntry.astro");
const projectEntryPath = resolve(root, "src/components/ProjectEntry.astro");
const profileCardPath = resolve(root, "src/components/ProfileCard.astro");

describe("annotation content model", () => {
  test("supports structured annotation segments in content without using margin mode in current content", async () => {
    const mod = await import(contentPath);
    expect(mod.homepage.profile.intro).toBeInstanceOf(Array);
    expect(mod.homepage.profile.note).toBeInstanceOf(Array);
    expect(
      mod.homepage.profile.note.some(
        (segment: unknown) =>
          segment &&
          typeof segment === "object" &&
          "type" in segment &&
          segment.type === "annotation" &&
          (!("mode" in segment) || segment.mode === "inline"),
      ),
    ).toBe(true);
    expect(
      mod.homepage.feed.some((entry: { type: string; lines?: unknown[] }) =>
        entry.type === "text" &&
        Array.isArray(entry.lines) &&
        entry.lines.some(
          (line) =>
            Array.isArray(line) &&
            line.some(
              (segment) =>
                segment &&
                typeof segment === "object" &&
                "type" in segment &&
                segment.type === "annotation" &&
                (!("mode" in segment) || segment.mode === "inline"),
            ),
        ),
      ),
    ).toBe(true);
    expect(JSON.stringify(mod.homepage)).not.toContain('"mode":"margin"');
  });
});

describe("annotation rendering integration", () => {
  test("provides a dedicated annotated line component", () => {
    const source = readFileSync(annotatedLinePath, "utf8");
    expect(source).toContain("annotation-inline");
    expect(source).toContain("annotation-margin");
    expect(source).toContain("annotation-bubble");
    expect(source).toContain("annotation-target");
  });

  test("routes feed text lines through the annotated line renderer", () => {
    const source = readFileSync(textEntryPath, "utf8");
    expect(source).toContain("<AnnotatedLine line={line} />");
  });

  test("routes image entry lines through the annotated line renderer", () => {
    const source = readFileSync(imageEntryPath, "utf8");
    expect(source).toContain("<AnnotatedLine line={line} />");
  });

  test("routes project summary lines through the annotated line renderer", () => {
    const source = readFileSync(projectEntryPath, "utf8");
    expect(source).toContain("<AnnotatedLine line={line} />");
  });

  test("routes profile intro through the annotated line renderer", () => {
    const source = readFileSync(profileCardPath, "utf8");
    expect(source).toContain("<AnnotatedLine line={profile.intro} />");
  });

  test("routes profile note through the annotated line renderer", () => {
    const source = readFileSync(profileCardPath, "utf8");
    expect(source).toContain("<AnnotatedLine line={profile.note} />");
  });

  test("keeps a special class for edge-pushed margin annotations", () => {
    const source = readFileSync(annotatedLinePath, "utf8");
    expect(source).toContain("annotation-edge");
  });
});
