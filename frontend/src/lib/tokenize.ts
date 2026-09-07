/** Whitespace-separated tokens; must stay in sync with transcript word-click indices. */
export function tokenizeTranscript(text: string): Array<{
  text: string;
  start: number;
  end: number;
  index: number;
}> {
  const result: Array<{ text: string; start: number; end: number; index: number }> = [];
  const re = /\S+/g;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = re.exec(text)) !== null) {
    result.push({
      text: match[0],
      start: match.index,
      end: match.index + match[0].length,
      index: index++,
    });
  }
  return result;
}
