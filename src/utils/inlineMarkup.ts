import type { InlineMark, InlineToken } from "../content/homepage";

const supportedMarks = new Set<InlineMark>(["highlight", "circle"]);
const tokenPattern = /<(highlight|circle)>(.*?)<\/\1>|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/gs;

export function parseInlineMarkup(input: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(input)) !== null) {
    const [fullMatch, rawMark, markedText, linkLabel, linkHref] = match;
    const matchIndex = match.index;

    if (matchIndex > lastIndex) {
      tokens.push({ text: input.slice(lastIndex, matchIndex), mark: "plain" });
    }

    if (linkLabel && linkHref) {
      tokens.push({ text: linkLabel, mark: "plain", href: linkHref });
    } else {
      const mark = rawMark as InlineMark;
      if (supportedMarks.has(mark)) {
        tokens.push({ text: markedText, mark });
      } else {
        tokens.push({ text: fullMatch, mark: "plain" });
      }
    }

    lastIndex = matchIndex + fullMatch.length;
  }

  if (lastIndex < input.length) {
    tokens.push({ text: input.slice(lastIndex), mark: "plain" });
  }

  if (tokens.length === 0) {
    return [{ text: input, mark: "plain" }];
  }

  return tokens;
}
