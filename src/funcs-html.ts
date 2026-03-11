interface ITagKeyValue {
  key: string;
  value?: string;
}
interface IEncodeHtmlOptions {
  preventDoubleEncoding?: boolean;
  encodeSpace?: boolean;
}

type EncodePair = {
  raw: string;
  encoded: string;
  encodeRegex: RegExp;
  decodeRegex: RegExp;
};

const ALL_ENCODE_PAIRS: EncodePair[] = [
  { raw: '&', encoded: '&amp;', encodeRegex: /&/g, decodeRegex: /&amp;/g },
  { raw: ' ', encoded: '&nbsp;', encodeRegex: / /g, decodeRegex: /&nbsp;/g },
  { raw: '<', encoded: '&lt;', encodeRegex: /</g, decodeRegex: /&lt;/g },
  { raw: '>', encoded: '&gt;', encodeRegex: />/g, decodeRegex: /&gt;/g },
  { raw: '"', encoded: '&quot;', encodeRegex: /"/g, decodeRegex: /&quot;/g },
  { raw: "'", encoded: '&#x27;', encodeRegex: /'/g, decodeRegex: /&#x27;/g },
  { raw: '/', encoded: '&#x2F;', encodeRegex: /\//g, decodeRegex: /&#x2F;/g },
  { raw: '(', encoded: '&#40;', encodeRegex: /\(/g, decodeRegex: /&#40;/g },
  { raw: ')', encoded: '&#41;', encodeRegex: /\)/g, decodeRegex: /&#41;/g },
];

const HTML_ENCODE_PAIRS_WITH_SPACE = ALL_ENCODE_PAIRS.filter(pair => pair.raw !== '(' && pair.raw !== ')');
const HTML_ENCODE_PAIRS_NO_SPACE = HTML_ENCODE_PAIRS_WITH_SPACE.filter(pair => pair.raw !== ' ');
const URL_ENCODE_PAIRS = ALL_ENCODE_PAIRS.filter(pair => pair.raw !== ' ' && pair.raw !== '/');

function makeStartTag(tag: any, attrs: ITagKeyValue | ITagKeyValue[] | undefined = undefined) {
  if (!tag) {
    return '';
  }

  let attrsStr = '';
  if (attrs) {
    const arrAttrs = Array.isArray(attrs) ? attrs : [attrs];
    for (let i = 0; i < arrAttrs.length; i++) {
      const attr = arrAttrs[i];
      if (i > 0) {
        attrsStr += ' ';
      }
      attrsStr += attr.key + (attr.value ? '="' + attr.value + '"' : '');
    }
  }

  let closing = '>';
  if (tag === 'img' || tag === 'br') {
    closing = '/>';
  }
  return attrsStr ? `<${tag} ${attrsStr}${closing}` : `<${tag}${closing}`;
}

function makeEndTag(tag: any = '') {
  return (tag && `</${tag}>`) || '';
}

function decodeHtml(str: string) {
  return applyDecodeMappings(str, HTML_ENCODE_PAIRS_WITH_SPACE);
}

function encodeHtml(
  str: string,
  { preventDoubleEncoding = true, encodeSpace = true }: IEncodeHtmlOptions = {}
) {
  if (preventDoubleEncoding) {
    str = decodeHtml(str);
  }
  return applyEncodeMappings(str, encodeSpace ? HTML_ENCODE_PAIRS_WITH_SPACE : HTML_ENCODE_PAIRS_NO_SPACE);
}

function encodeLink(str: string) {
  let decoded = applyDecodeMappings(str, URL_ENCODE_PAIRS);
  return applyEncodeMappings(decoded, URL_ENCODE_PAIRS);
}

function applyEncodeMappings(str: string, mappings: EncodePair[]) {
  for (let i = 0; i < mappings.length; i++) {
    str = str.replace(mappings[i].encodeRegex, mappings[i].encoded);
  }
  return str;
}

function applyDecodeMappings(str: string, mappings: EncodePair[]) {
  for (let i = 0; i < mappings.length; i++) {
    str = str.replace(mappings[i].decodeRegex, mappings[i].raw);
  }
  return str;
}
export { makeStartTag, makeEndTag, encodeHtml, decodeHtml, encodeLink, ITagKeyValue };
