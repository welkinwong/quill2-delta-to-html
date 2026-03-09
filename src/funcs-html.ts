interface ITagKeyValue {
  key: string;
  value?: string;
}
interface IEncodeHtmlOptions {
  preventDoubleEncoding?: boolean;
  encodeSpace?: boolean;
}

enum EncodeTarget {
  Html = 0,
  Url = 1,
}

function makeStartTag(tag: any, attrs: ITagKeyValue | ITagKeyValue[] | undefined = undefined) {
  if (!tag) {
    return '';
  }

  var attrsStr = '';
  if (attrs) {
    var arrAttrs = ([] as ITagKeyValue[]).concat(attrs);
    attrsStr = arrAttrs
      .map(function (attr: any) {
        return attr.key + (attr.value ? '="' + attr.value + '"' : '');
      })
      .join(' ');
  }

  var closing = '>';
  if (tag === 'img' || tag === 'br') {
    closing = '/>';
  }
  return attrsStr ? `<${tag} ${attrsStr}${closing}` : `<${tag}${closing}`;
}

function makeEndTag(tag: any = '') {
  return (tag && `</${tag}>`) || '';
}

function decodeHtml(str: string) {
  return encodeMappings(EncodeTarget.Html).reduce(decodeMapping, str);
}

function encodeHtml(
  str: string,
  { preventDoubleEncoding = true, encodeSpace = true }: IEncodeHtmlOptions = {}
) {
  if (preventDoubleEncoding) {
    str = decodeHtml(str);
  }
  return encodeMappings(EncodeTarget.Html, encodeSpace).reduce(encodeMapping, str);
}

function encodeLink(str: string) {
  let linkMaps = encodeMappings(EncodeTarget.Url);
  let decoded = linkMaps.reduce(decodeMapping, str);
  return linkMaps.reduce(encodeMapping, decoded);
}

function encodeMappings(mtype: EncodeTarget, encodeSpace = true) {
  let maps = [
    ['&', '&amp;'],
    [' ', '&nbsp;'],
    ['<', '&lt;'],
    ['>', '&gt;'],
    ['"', '&quot;'],
    ["'", '&#x27;'],
    ['\\/', '&#x2F;'],
    ['\\(', '&#40;'],
    ['\\)', '&#41;'],
  ];
  if (mtype === EncodeTarget.Html) {
    return maps.filter(
      ([v, _]) => (encodeSpace || v.indexOf(' ') === -1) && v.indexOf('(') === -1 && v.indexOf(')') === -1
    );
  } else {
    // for url
    return maps.filter(([v, _]) => v.indexOf(' ') === -1 && v.indexOf('/') === -1);
  }
}
function encodeMapping(str: string, mapping: string[]) {
  return str.replace(new RegExp(mapping[0], 'g'), mapping[1]);
}
function decodeMapping(str: string, mapping: string[]) {
  return str.replace(new RegExp(mapping[1], 'g'), mapping[0].replace('\\', ''));
}
export { makeStartTag, makeEndTag, encodeHtml, decodeHtml, encodeLink, ITagKeyValue };
