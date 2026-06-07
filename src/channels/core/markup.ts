export type MarkupNode =
  | { type: "text"; value: string }
  | { type: "highlight"; value: string }
  | { type: "link"; value: string; href: string }
  | { type: "anno"; value: string; note: string };

export interface MarkupDocument {
  raw: string;
  nodes: MarkupNode[];
}

export interface ParseMarkupError {
  code: string;
  message: string;
  index?: number;
}

export interface ParseMarkupResult {
  document: MarkupDocument;
  errors: ParseMarkupError[];
}

export interface ControlTagParseResult {
  tags: string[];
  content: string;
}

const controlTagPattern = /^((?:#[A-Za-z0-9_-]+(?:[ \t]+|(?:\r?\n)+))+)([\s\S]*)$/;
const supportedTagPattern =
  /<(anno)\s+note="([^"]*)">([\s\S]*?)<\/anno>|<(highlight)>([\s\S]*?)<\/highlight>|<(link)\s+href="([^"]*)">([\s\S]*?)<\/link>/g;
const malformedSupportedMarkupPattern = /<\/?(?:anno|highlight|link)\b[^>]*>/;

export function extractControlTags(input: string): ControlTagParseResult {
  const match = input.match(controlTagPattern);

  if (!match) {
    return { tags: [], content: input };
  }

  const [, tagBlock, rest] = match;
  const tags = Array.from(tagBlock.matchAll(/#([A-Za-z0-9_-]+)/g), (tagMatch) => tagMatch[1]);

  return {
    tags,
    content: rest.trimStart(),
  };
}

export function parseMarkup(input: string): ParseMarkupResult {
  const errors: ParseMarkupError[] = [];
  const nodes: MarkupNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = supportedTagPattern.exec(input)) !== null) {
    const [fullMatch, annoTag, annoNote, annoValue, highlightTag, highlightValue, linkTag, linkHref, linkValue] =
      match;

    if (match.index > lastIndex) {
      pushTextNode(nodes, input.slice(lastIndex, match.index));
    }

    if (annoTag) {
      nodes.push({ type: "anno", value: annoValue, note: annoNote });
    } else if (highlightTag) {
      nodes.push({ type: "highlight", value: highlightValue });
    } else if (linkTag) {
      nodes.push({ type: "link", value: linkValue, href: linkHref });
    } else {
      pushTextNode(nodes, fullMatch);
    }

    lastIndex = match.index + fullMatch.length;
  }

  if (lastIndex < input.length) {
    pushTextNode(nodes, input.slice(lastIndex));
  }

  if (malformedSupportedMarkupPattern.test(input) && nodes.length === 1 && nodes[0]?.type === "text") {
    errors.push({
      code: "invalid_markup",
      message: "Unsupported or malformed markup was treated as plain text.",
    });
  }

  return {
    document: {
      raw: input,
      nodes: nodes.length > 0 ? nodes : [{ type: "text", value: input }],
    },
    errors,
  };
}

function pushTextNode(nodes: MarkupNode[], value: string) {
  if (!value) {
    return;
  }

  const lastNode = nodes[nodes.length - 1];

  if (lastNode?.type === "text") {
    lastNode.value += value;
    return;
  }

  nodes.push({ type: "text", value });
}
