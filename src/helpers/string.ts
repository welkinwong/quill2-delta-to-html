/**
 *  Splits by new line character ("\n") by putting new line characters into the
 *  array as well. Ex: "hello\n\nworld\n " => ["hello", "\n", "\n", "world", "\n", " "]
 */

function tokenizeWithNewLines(str: string): string[] {
  const NewLine = '\n';

  if (str === NewLine) {
    return [str];
  }

  if (str.indexOf(NewLine) === -1) {
    return [str];
  }

  const tokens: string[] = [];
  let start = 0;
  for (let i = 0; i < str.length; i++) {
    if (str.charCodeAt(i) === 10) {
      if (i > start) {
        tokens.push(str.slice(start, i));
      }
      tokens.push(NewLine);
      start = i + 1;
    }
  }
  if (start < str.length) {
    tokens.push(str.slice(start));
  }
  return tokens;
}

export { tokenizeWithNewLines };
