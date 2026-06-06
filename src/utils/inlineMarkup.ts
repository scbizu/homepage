import type { InlineMark, InlineToken } from "../content/homepage";

const supportedMarks = new Set<InlineMark>(["highlight", "circle"]);
const tagPattern = /<(highlight|circle)>(.*?)<\/\1>/gs;

export function parseInlineMarkup(input: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(input)) !== null) {
    const [fullMatch, rawMark, markedText] = match;
    const matchIndex = match.index;

    if (matchIndex > lastIndex) {
      tokens.push({ text: input.slice(lastIndex, matchIndex), mark: "plain" });
    }

    const mark = rawMark as InlineMark;
    if (supportedMarks.has(mark)) {
      tokens.push({ text: markedText, mark });
    } else {
      tokens.push({ text: fullMatch, mark: "plain" });
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
