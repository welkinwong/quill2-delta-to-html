import 'mocha';
import * as assert from 'assert';

import { DeltaInsertOp } from './../src/DeltaInsertOp';
import { QuillDeltaToHtmlConverter } from './../src/QuillDeltaToHtmlConverter';
import { callWhenXEqualY } from './_helper';

import { delta1 } from './data/delta1';
import { GroupType, ListType } from './../src/value-types';
import { encodeHtml } from './../src/funcs-html';

describe('QuillDeltaToHtmlConverter', function () {
  describe('constructor()', function () {
    var hugeOps = [{ insert: 'huge', attributes: { size: 'huge', attr1: 'red' } }, { insert: '\n' }];

    it('should instantiate return proper html', function () {
      var qdc = new QuillDeltaToHtmlConverter(delta1.ops, {
        classPrefix: 'noz',
      });
      var html = qdc.convert();
      assert.equal(html, delta1.html);
    });

    it('should set default inline styles for `inlineStyles: true`', function () {
      var qdc = new QuillDeltaToHtmlConverter(hugeOps, {
        inlineStyles: true,
        customCssStyles: op => {
          if (op.attributes['attr1'] === 'red') {
            return ['color:red'];
          }
        },
      });
      var html = qdc.convert();
      assert.equal(html.includes('<span style="font-size: 2.5em;color:red">huge</span>'), true, html);
    });

    it('should set default inline styles when `inlineStyles` is a truthy non-object', function () {
      var qdc = new QuillDeltaToHtmlConverter(hugeOps, {
        inlineStyles: 1,
      } as any);
      var html = qdc.convert();
      assert.equal(html.includes('<span style="font-size: 2.5em">huge</span>'), true, html);
    });

    it('should allow setting inline styles', function () {
      var qdc = new QuillDeltaToHtmlConverter(hugeOps, {
        inlineStyles: {
          size: {
            huge: 'font-size: 6em',
          },
        },
      });
      var html = qdc.convert();
      assert.equal(html.includes('<span style="font-size: 6em">huge</span>'), true, html);
    });
  });

  describe('convert()', function () {
    var ops2 = [
      { insert: 'this is text' },
      { insert: '\n' },
      { insert: 'this is code' },
      { insert: '\n', attributes: { 'code-block': true } },
      { insert: 'this is code TOO!' },
      { insert: '\n', attributes: { 'code-block': true } },
    ];

    it('should render html', function () {
      var qdc = new QuillDeltaToHtmlConverter(ops2);

      var html = qdc.convert();
      assert.equal(html.indexOf('<div class="ql-code-block-container">') > -1, true, html);
      assert.equal(html.indexOf('class="ql-code-block"') > -1, true, html);
    });

    it('should render each \\n as block boundary (e.g. {"insert": "\\n\\n"} as two empty paragraphs)', function () {
      var qdc = new QuillDeltaToHtmlConverter([{ insert: '\n\n' }], { paragraphTag: 'p' });
      var html = qdc.convert();
      assert.equal(html, '<p><br/></p><p><br/></p>');
    });

    it('should render mention', function () {
      let ops = [
        {
          insert: 'mention',
          attributes: {
            mentions: true,
            mention: {
              'end-point': 'http://abc.com',
              slug: 'a',
              class: 'abc',
              target: '_blank',
            },
          },
        },
      ];
      var qdc = new QuillDeltaToHtmlConverter(ops);
      var html = qdc.convert();
      assert.equal(
        html,
        ['<p><a class="abc"', ' href="http://abc.com/a" target="_blank"', '>mention</a></p>'].join('')
      );

      var qdc = new QuillDeltaToHtmlConverter([
        {
          insert: 'mention',
          attributes: {
            mentions: true,
            mention: { slug: 'aa' },
          },
        },
      ]);
      var html = qdc.convert();
      assert.equal(html, ['<p><a', ' href="about:blank">mention</a></p>'].join(''));
    });
    it('should render links with rels', function () {
      var ops = [
        {
          attributes: {
            link: '#',
            rel: 'nofollow noopener',
          },
          insert: 'external link',
        },
        {
          attributes: {
            link: '#',
          },
          insert: 'internal link',
        },
      ];
      var qdc = new QuillDeltaToHtmlConverter(ops, {
        linkRel: 'license',
      });
      var html = qdc.convert();
      assert.equal(
        html,
        '<p><a href="#" target="_blank" rel="nofollow noopener">external&nbsp;link</a><a href="#" target="_blank" rel="license">internal&nbsp;link</a></p>'
      );

      qdc = new QuillDeltaToHtmlConverter(ops);
      html = qdc.convert();
      assert.equal(
        html,
        '<p><a href="#" target="_blank" rel="nofollow noopener">external&nbsp;link</a><a href="#" target="_blank" rel="noopener noreferrer">internal&nbsp;link</a></p>'
      );
    });
    it('should render image and image links', function () {
      let ops = [
        { insert: { image: 'http://yahoo.com/abc.jpg' } },
        {
          insert: { image: 'http://yahoo.com/def.jpg' },
          attributes: { link: 'http://aha' },
        },
      ];
      let qdc = new QuillDeltaToHtmlConverter(ops);
      let html = qdc.convert();
      assert.equal(
        html,
        [
          '<p>',
          '<img class="ql-image" src="http://yahoo.com/abc.jpg"/>',
          '<a href="http://aha" target="_blank" rel="noopener noreferrer">',
          '<img class="ql-image" src="http://yahoo.com/def.jpg"/>',
          '</a>',
          '</p>',
        ].join('')
      );
    });

    it('should open and close list tags', function () {
      var ops4 = [
        { insert: 'mr\n' },
        { insert: 'hello' },
        { insert: '\n', attributes: { list: 'ordered' } },
        { insert: 'there' },
        { insert: '\n', attributes: { list: 'bullet' } },
        { insert: '\n', attributes: { list: 'ordered' } },
      ];
      var qdc = new QuillDeltaToHtmlConverter(ops4, { simpleList: true });
      var html = qdc.convert();

      assert.equal(html.indexOf('<p>mr') > -1, true);
      assert.equal(html.indexOf('</ol><ul><li>there') > -1, true);
    });

    it('should create checked/unchecked lists', function () {
      var ops4 = [
        { insert: 'hello' },
        { insert: '\n', attributes: { list: 'checked' } },
        { insert: 'there' },
        { insert: '\n', attributes: { list: 'unchecked' } },
        { insert: 'man' },
        { insert: '\n', attributes: { list: 'checked' } },
        { insert: 'not done' },
        { insert: '\n', attributes: { indent: 1, list: 'unchecked' } },
      ];
      var qdc = new QuillDeltaToHtmlConverter(ops4, { simpleList: true });
      var html = qdc.convert();
      assert.equal(
        html,
        [
          '<ul>',
          '<li data-checked="true">hello</li>',
          '<li data-checked="false">there</li>',
          '<li data-checked="true">man</li>',
          '<li class="ql-indent-1" data-checked="false">not&nbsp;done</li>',
          '</ul>',
        ].join('')
      );
    });

    it('should wrap positional styles in right tag', function () {
      var ops4 = [
        { insert: 'mr' },
        { insert: '\n', attributes: { align: 'center' } },
        { insert: '\n', attributes: { direction: 'rtl' } },
        { insert: '\n', attributes: { indent: 2 } },
      ];
      var qdc = new QuillDeltaToHtmlConverter(ops4, { paragraphTag: 'div' });
      var html = qdc.convert();
      assert.equal(html.indexOf('<div class="ql-align') > -1, true);
      assert.equal(html.indexOf('<div class="ql-direction') > -1, true);
      assert.equal(html.indexOf('<div class="ql-indent') > -1, true);

      var qdc = new QuillDeltaToHtmlConverter(ops4);
      var html = qdc.convert();
      assert.equal(html.indexOf('<p class="ql-align') > -1, true);
      assert.equal(html.indexOf('<p class="ql-direction') > -1, true);
      assert.equal(html.indexOf('<p class="ql-indent') > -1, true);
    });
    it('should render target attr correctly', () => {
      let ops = [
        { attributes: { target: '_self', link: 'http://#' }, insert: 'A' },
        { attributes: { target: '_blank', link: 'http://#' }, insert: 'B' },
        { attributes: { link: 'http://#' }, insert: 'C' },
        { insert: '\n' },
      ];
      let qdc = new QuillDeltaToHtmlConverter(ops, { linkTarget: '' });
      let html = qdc.convert();
      assert.equal(
        html,
        [
          `<p><a href="http://#" target="_self" rel="noopener noreferrer">A</a>`,
          `<a href="http://#" target="_blank" rel="noopener noreferrer">B</a>`,
          `<a href="http://#" rel="noopener noreferrer">C</a></p>`,
        ].join('')
      );

      qdc = new QuillDeltaToHtmlConverter(ops);
      html = qdc.convert();
      assert.equal(
        html,
        [
          `<p><a href="http://#" target="_self" rel="noopener noreferrer">A</a>`,
          `<a href="http://#" target="_blank" rel="noopener noreferrer">BC</a></p>`,
        ].join('')
      );

      qdc = new QuillDeltaToHtmlConverter(ops, { linkTarget: '_top' });
      html = qdc.convert();
      assert.equal(
        html,
        [
          `<p><a href="http://#" target="_self" rel="noopener noreferrer">A</a>`,
          `<a href="http://#" target="_blank" rel="noopener noreferrer">B</a>`,
          `<a href="http://#" target="_top" rel="noopener noreferrer">C</a></p>`,
        ].join('')
      );
    });

    it('should convert using custom url sanitizer', () => {
      let ops = [
        { attributes: { link: 'http://yahoo<%=abc%>/ed' }, insert: 'test' },
        { attributes: { link: 'http://abc<' }, insert: 'hi' },
      ];

      let qdc = new QuillDeltaToHtmlConverter(ops, {
        urlSanitizer: (link: string) => {
          if (link.indexOf('<%') > -1) {
            return link;
          }
          return undefined;
        },
      });
      assert.equal(
        qdc.convert(),
        [
          `<p><a href="http://yahoo<%=abc%>/ed" target="_blank" rel="noopener noreferrer">test</a>`,
          `<a href="http://abc&lt;" target="_blank" rel="noopener noreferrer">hi</a></p>`,
        ].join('')
      );
    });

    it('should render empty table', () => {
      let ops = [
        {
          insert: '\n\n\n',
          attributes: {
            table: 'row-1',
          },
        },
        {
          attributes: {
            table: 'row-2',
          },
          insert: '\n\n\n',
        },
        {
          attributes: {
            table: 'row-3',
          },
          insert: '\n\n\n',
        },
        {
          insert: '\n',
        },
      ];

      let qdc = new QuillDeltaToHtmlConverter(ops);
      assert.equal(
        qdc.convert(),
        [
          `<table><tbody>`,
          `<tr><td data-row="row-1"><br/></td><td data-row="row-1"><br/></td><td data-row="row-1"><br/></td></tr>`,
          `<tr><td data-row="row-2"><br/></td><td data-row="row-2"><br/></td><td data-row="row-2"><br/></td></tr>`,
          `<tr><td data-row="row-3"><br/></td><td data-row="row-3"><br/></td><td data-row="row-3"><br/></td></tr>`,
          `</tbody></table>`,
          `<p><br/></p>`,
        ].join('')
      );
    });

    it('should render singe cell table', () => {
      let ops = [
        {
          insert: 'cell',
        },
        {
          insert: '\n',
          attributes: {
            table: 'row-1',
          },
        },
      ];

      let qdc = new QuillDeltaToHtmlConverter(ops);
      assert.equal(
        qdc.convert(),
        [`<table><tbody>`, `<tr><td data-row="row-1">cell</td></tr>`, `</tbody></table>`].join('')
      );
    });

    it('should render filled table', () => {
      let ops = [
        {
          insert: '11',
        },
        {
          attributes: {
            table: 'row-1',
          },
          insert: '\n',
        },
        {
          insert: '12',
        },
        {
          attributes: {
            table: 'row-1',
          },
          insert: '\n',
        },
        {
          insert: '13',
        },
        {
          attributes: {
            table: 'row-1',
          },
          insert: '\n',
        },
        {
          insert: '21',
        },
        {
          attributes: {
            table: 'row-2',
          },
          insert: '\n',
        },
        {
          insert: '22',
        },
        {
          attributes: {
            table: 'row-2',
          },
          insert: '\n',
        },
        {
          insert: '23',
        },
        {
          attributes: {
            table: 'row-2',
          },
          insert: '\n',
        },
        {
          insert: '31',
        },
        {
          attributes: {
            table: 'row-3',
          },
          insert: '\n',
        },
        {
          insert: '32',
        },
        {
          attributes: {
            table: 'row-3',
          },
          insert: '\n',
        },
        {
          insert: '33',
        },
        {
          attributes: {
            table: 'row-3',
          },
          insert: '\n',
        },
        {
          insert: '\n',
        },
      ];

      let qdc = new QuillDeltaToHtmlConverter(ops);
      assert.equal(
        qdc.convert(),
        [
          `<table><tbody>`,
          `<tr><td data-row="row-1">11</td><td data-row="row-1">12</td><td data-row="row-1">13</td></tr>`,
          `<tr><td data-row="row-2">21</td><td data-row="row-2">22</td><td data-row="row-2">23</td></tr>`,
          `<tr><td data-row="row-3">31</td><td data-row="row-3">32</td><td data-row="row-3">33</td></tr>`,
          `</tbody></table>`,
          `<p><br/></p>`,
        ].join('')
      );
    });
  });

  describe('custom types', () => {
    it(`should return empty string if renderer not defined for
                           custom blot`, () => {
      let ops = [{ insert: { customstuff: 'my val' } }];
      let qdc = new QuillDeltaToHtmlConverter(ops);
      assert.equal(qdc.convert(), '<p><br/></p>');
    });
    it('should render custom insert types with given renderer', () => {
      let ops = [{ insert: { bolditalic: 'my text' } }, { insert: { blah: 1 } }];
      let qdc = new QuillDeltaToHtmlConverter(ops);
      qdc.renderCustomWith(op => {
        if (op.insert.type === 'bolditalic') {
          return '<b><i>' + op.insert.value + '</i></b>';
        }
        return 'unknown';
      });
      let html = qdc.convert();
      assert.equal(html, '<p><b><i>my text</i></b>unknown</p>');
    });

    it('should render custom insert types as blocks if renderAsBlock is specified', () => {
      let ops = [
        { insert: 'hello ' },
        { insert: { myblot: 'my friend' } },
        { insert: '!' },
        { insert: { myblot: 'how r u?' }, attributes: { renderAsBlock: true } },
      ];
      let qdc = new QuillDeltaToHtmlConverter(ops);
      qdc.renderCustomWith(op => {
        if (op.insert.type === 'myblot') {
          return op.attributes.renderAsBlock ? '<div>' + op.insert.value + '</div>' : op.insert.value;
        }
        return 'unknown';
      });
      let html = qdc.convert();
      assert.equal(html, '<p>hello&nbsp;my friend!</p><div>how r u?</div>');
    });

    it('should apply inline formats to custom inline embeds', () => {
      let ops = [
        { insert: { myblot: 'id-1' }, attributes: { bold: true, italic: true } },
        { insert: { myblot: 'id-2' }, attributes: { link: 'https://example.com', underline: true } },
      ];
      let qdc = new QuillDeltaToHtmlConverter(ops);
      qdc.renderCustomWith(op => {
        if (op.insert.type === 'myblot') {
          return `<span data-myblot="${op.insert.value}"></span>`;
        }
        return '';
      });
      let html = qdc.convert();
      assert.equal(
        html,
        '<p><strong><em><span data-myblot="id-1"></span></em></strong><u><a href="https://example.com" target="_blank" rel="noopener noreferrer"><span data-myblot="id-2"></span></a></u></p>'
      );
    });

    it('should keep custom inline embeds unchanged when no inline formats are provided', () => {
      let ops = [{ insert: { myblot: 'id-1' } }];
      let qdc = new QuillDeltaToHtmlConverter(ops);
      qdc.renderCustomWith(op => {
        if (op.insert.type === 'myblot') {
          return `<span data-myblot="${op.insert.value}"></span>`;
        }
        return '';
      });
      let html = qdc.convert();
      assert.equal(html, '<p><span data-myblot="id-1"></span></p>');
    });

    it('should render custom insert types in code blocks with given renderer', () => {
      let ops = [
        { insert: { colonizer: ':' } },
        { insert: '\n', attributes: { 'code-block': true } },
        { insert: 'code1' },
        { insert: '\n', attributes: { 'code-block': true } },
        { insert: { colonizer: ':' } },
        { insert: '\n', attributes: { 'code-block': true } },
      ];
      let renderer = (op: DeltaInsertOp) => {
        if (op.insert.type === 'colonizer') {
          return op.insert.value;
        }
        return '';
      };
      let qdc = new QuillDeltaToHtmlConverter(ops.slice(0, 2), { simpleCodeBlock: true });
      qdc.renderCustomWith(renderer);
      assert.equal(qdc.convert(), '<pre>:</pre>');

      qdc = new QuillDeltaToHtmlConverter(ops, { simpleCodeBlock: true });
      qdc.renderCustomWith(renderer);
      assert.equal(qdc.convert(), '<pre>:<br/>code1<br/>:</pre>');

      qdc = new QuillDeltaToHtmlConverter(ops, {
        simpleCodeBlock: true,
        customTag: format => {
          if (format === 'code-block') {
            return 'code';
          }
        },
      });
      qdc.renderCustomWith(renderer);
      assert.equal(qdc.convert(), '<pre>:<br/>code1<br/>:</pre>');
    });

    it('should render custom insert types in headers with given renderer', () => {
      let ops = [
        { insert: { colonizer: ':' } },
        { insert: '\n', attributes: { header: 1 } },
        { insert: 'hello' },
        { insert: '\n', attributes: { header: 1 } },
        { insert: { colonizer: ':' } },
        { insert: '\n', attributes: { header: 1 } },
      ];
      let renderer = (op: DeltaInsertOp) => {
        if (op.insert.type === 'colonizer') {
          return op.insert.value;
        }
        return '';
      };
      let qdc = new QuillDeltaToHtmlConverter(ops.slice(0, 2));
      qdc.renderCustomWith(renderer);
      assert.equal(qdc.convert(), '<h1>:</h1>');

      qdc = new QuillDeltaToHtmlConverter(ops);
      qdc.renderCustomWith(renderer);
      assert.equal(qdc.convert(), '<h1>:</h1><h1>hello</h1><h1>:</h1>');
    });
  });

  describe('_getListTag()', function () {
    it('should return proper list tag', function () {
      var op = new DeltaInsertOp('\n', { list: ListType.Ordered });
      var qdc = new QuillDeltaToHtmlConverter(delta1.ops);
      assert.equal(qdc._getListTag(op), 'ol');

      op = new DeltaInsertOp('\n', { list: ListType.Bullet });
      assert.equal(qdc._getListTag(op), 'ol');

      op = new DeltaInsertOp('\n', { list: ListType.Checked });
      assert.equal(qdc._getListTag(op), 'ol');

      op = new DeltaInsertOp('\n', { list: ListType.Unchecked });
      assert.equal(qdc._getListTag(op), 'ol');

      qdc = new QuillDeltaToHtmlConverter(delta1.ops, { simpleList: true });

      op = new DeltaInsertOp('\n', { list: ListType.Bullet });
      assert.equal(qdc._getListTag(op), 'ul');

      op = new DeltaInsertOp('\n', { list: ListType.Checked });
      assert.equal(qdc._getListTag(op), 'ul');

      op = new DeltaInsertOp('\n', { list: ListType.Unchecked });
      assert.equal(qdc._getListTag(op), 'ul');

      op = new DeltaInsertOp('d');
      assert.equal(qdc._getListTag(op), '');
    });
  });

  describe(' prepare data before inline and block renders', function () {
    var ops: any;
    beforeEach(function () {
      ops = [
        { insert: 'Hello' },
        { insert: ' my ', attributes: { italic: true } },
        { insert: '\n', attributes: { italic: true } },
        { insert: ' name is joey' },
      ].map((v: any) => new DeltaInsertOp(v.insert, v.attributes));
    });

    describe('renderInlines()', function () {
      it('should render inlines', function () {
        var qdc = new QuillDeltaToHtmlConverter([]);
        var inlines = qdc._renderInlines(ops);
        assert.equal(inlines, ['<p>Hello', '<em>&nbsp;my&nbsp;</em></p><p>&nbsp;name&nbsp;is&nbsp;joey</p>'].join(''));

        qdc = new QuillDeltaToHtmlConverter([], { paragraphTag: 'div' });
        var inlines = qdc._renderInlines(ops);
        assert.equal(inlines, '<div>Hello<em>&nbsp;my&nbsp;</em></div><div>&nbsp;name&nbsp;is&nbsp;joey</div>');

        qdc = new QuillDeltaToHtmlConverter([], { paragraphTag: '' });
        var inlines = qdc._renderInlines(ops);
        assert.equal(inlines, 'Hello<em>&nbsp;my&nbsp;</em>&nbsp;name&nbsp;is&nbsp;joey');
      });

      it('should render inlines custom tag', function () {
        var qdc = new QuillDeltaToHtmlConverter([], {
          customTag: format => {
            if (format === 'italic') {
              return 'i';
            }
          },
        });
        var inlines = qdc._renderInlines(ops);
        assert.equal(inlines, ['<p>Hello', '<i>&nbsp;my&nbsp;</i></p><p>&nbsp;name&nbsp;is&nbsp;joey</p>'].join(''));

        qdc = new QuillDeltaToHtmlConverter([], { paragraphTag: 'div' });
        var inlines = qdc._renderInlines(ops);
        assert.equal(inlines, '<div>Hello<em>&nbsp;my&nbsp;</em></div><div>&nbsp;name&nbsp;is&nbsp;joey</div>');

        qdc = new QuillDeltaToHtmlConverter([], { paragraphTag: '' });
        var inlines = qdc._renderInlines(ops);
        assert.equal(inlines, 'Hello<em>&nbsp;my&nbsp;</em>&nbsp;name&nbsp;is&nbsp;joey');
      });

      it('should render plain new line string', function () {
        var ops = [new DeltaInsertOp('\n')];
        var qdc = new QuillDeltaToHtmlConverter([]);
        assert.equal(qdc._renderInlines(ops), '<p><br/></p>');
      });

      it('should render styled new line string', function () {
        var ops = [new DeltaInsertOp('\n', { font: 'arial' })];
        var qdc = new QuillDeltaToHtmlConverter([]);
        assert.equal(qdc._renderInlines(ops), '<p><br/></p>');

        var qdc = new QuillDeltaToHtmlConverter([], { paragraphTag: '' });
        assert.equal(qdc._renderInlines(ops), '<br/>');
      });

      it('should render when first line is new line', function () {
        var ops = [new DeltaInsertOp('\n'), new DeltaInsertOp('aa')];
        var qdc = new QuillDeltaToHtmlConverter([]);
        assert.equal(qdc._renderInlines(ops), '<p><br/></p><p>aa</p>');
      });

      it('should render when last line is new line', function () {
        var ops = [new DeltaInsertOp('aa'), new DeltaInsertOp('\n')];
        var qdc = new QuillDeltaToHtmlConverter([]);
        assert.equal(qdc._renderInlines(ops), '<p>aa</p>');
      });

      it('should render mixed lines', function () {
        var ops = [new DeltaInsertOp('aa'), new DeltaInsertOp('bb')];
        var nlop = new DeltaInsertOp('\n');
        var stylednlop = new DeltaInsertOp('\n', {
          color: '#333',
          italic: true,
        });
        var qdc = new QuillDeltaToHtmlConverter([]);
        assert.equal(qdc._renderInlines(ops), '<p>aabb</p>');

        var ops0 = [nlop, ops[0], nlop, ops[1]];
        assert.equal(qdc._renderInlines(ops0), '<p><br/></p><p>aa</p><p>bb</p>');

        var ops4 = [ops[0], stylednlop, stylednlop, stylednlop, ops[1]];
        assert.equal(qdc._renderInlines(ops4), ['<p>aa</p><p><br/></p><p><br/></p><p>bb</p>'].join(''));
      });
    });

    describe('renderBlock()', function () {
      var op = new DeltaInsertOp('\n', { header: 3, indent: 2 });
      var inlineop = new DeltaInsertOp('hi there');
      it('should render container block', function () {
        var qdc = new QuillDeltaToHtmlConverter([]);
        var blockhtml = qdc._renderBlock(op, [inlineop]);
        assert.equal(blockhtml, ['<h3 class="ql-indent-2">', 'hi&nbsp;there</h3>'].join(''));

        var qdc = new QuillDeltaToHtmlConverter([]);
        var blockhtml = qdc._renderBlock(op, []);
        assert.equal(blockhtml, ['<h3 class="ql-indent-2">', '<br/></h3>'].join(''));
      });

      it('should correctly render code block', function () {
        let ops = [
          {
            insert: 'line 1',
          },
          {
            attributes: {
              'code-block': true,
            },
            insert: '\n',
          },
          {
            insert: 'line 2',
          },
          {
            attributes: {
              'code-block': true,
            },
            insert: '\n',
          },
          {
            insert: 'line 3',
          },
          {
            attributes: {
              'code-block': 'javascript',
            },
            insert: '\n',
          },
          {
            insert: '<p>line 4</p>',
          },
          {
            attributes: {
              'code-block': true,
            },
            insert: '\n',
          },
          {
            insert: 'line 5',
          },
          {
            attributes: {
              'code-block': 'ja"va',
            },
            insert: '\n',
          },
        ];
        //console.log(encodeHtml("<p>line 4</p>"));
        var qdc = new QuillDeltaToHtmlConverter(ops, { simpleCodeBlock: true });
        let html = qdc.convert();
        assert.equal(
          html,
          '<pre>line&nbsp;1<br/>line&nbsp;2<br/>line&nbsp;3<br/>' +
            encodeHtml('<p>line 4</p>') +
            '<br/>line&nbsp;5</pre>'
        );

        qdc = new QuillDeltaToHtmlConverter(ops, { simpleCodeBlock: true });
        html = qdc.convert();
        assert.equal(
          '<pre>line&nbsp;1<br/>line&nbsp;2<br/>line&nbsp;3<br/>' +
            encodeHtml('<p>line 4</p>') +
            '<br/>line&nbsp;5</pre>',
          html
        );
        qdc = new QuillDeltaToHtmlConverter([ops[0], ops[1]], { simpleCodeBlock: true });
        html = qdc.convert();
        assert.equal(html, '<pre>line&nbsp;1</pre>');
      });
    });

    it('should correctly render custom text block', function () {
      let ops = [
        {
          insert: 'line 1',
        },
        {
          attributes: {
            renderAsBlock: true,
            attr1: true,
          },
          insert: '\n',
        },
        {
          insert: 'line 2',
        },
        {
          attributes: {
            renderAsBlock: true,
            attr1: true,
          },
          insert: '\n',
        },
        {
          insert: 'line 3',
        },
        {
          attributes: {
            renderAsBlock: true,
            attr2: true,
          },
          insert: '\n',
        },
        {
          insert: '<p>line 4</p>',
        },
        {
          attributes: {
            renderAsBlock: true,
            attr1: true,
          },
          insert: '\n',
        },
        {
          insert: 'line 5',
        },
        {
          attributes: {
            renderAsBlock: true,
            attr1: 'test',
          },
          insert: '\n',
        },
      ];
      //console.log(encodeHtml("<p>line 4</p>"));
      var qdc = new QuillDeltaToHtmlConverter(ops, {
        customTag: (format, op) => {
          if (format === 'renderAsBlock' && op.attributes['attr1'] === 'test') {
            return 'test';
          }
        },
        customTagAttributes: op => {
          if (op.attributes['attr1'] === 'test') {
            return {
              attr1: op.attributes['attr1'],
            };
          }
        },
        customCssClasses: op => {
          if (op.attributes['attr1'] === 'test') {
            return ['ql-test'];
          }
        },
        customCssStyles: op => {
          if (op.attributes['attr1'] === 'test') {
            return ['color:red'];
          }
        },
      });
      let html = qdc.convert();
      assert.equal(
        html,
        [
          '<p>line&nbsp;1</p>',
          '<p>line&nbsp;2</p>',
          '<p>line&nbsp;3</p>',
          '<p>',
          encodeHtml('<p>line&nbsp;4</p>'),
          '</p>',
          '<test class="ql-test" style="color:red" attr1="test">line&nbsp;5</test>',
        ].join('')
      );

      qdc = new QuillDeltaToHtmlConverter(ops);
      html = qdc.convert();
      assert.equal(
        '<p>line&nbsp;1</p><p>line&nbsp;2</p>' +
          '<p>line&nbsp;3</p>' +
          '<p>' +
          encodeHtml('<p>line 4</p>') +
          '</p>' +
          '<p>line&nbsp;5</p>',
        html
      );
      qdc = new QuillDeltaToHtmlConverter([ops[0], ops[1]]);
      html = qdc.convert();
      assert.equal(html, '<p>line&nbsp;1</p>');
    });

    describe('before n after renders()', function () {
      var ops = [
        { insert: 'hello', attributes: { bold: true } },
        { insert: '\n', attributes: { bold: true } },
        { insert: 'how r u?' },
        { insert: 'r u fine' },
        { insert: '\n', attributes: { blockquote: true } },
        { insert: { video: 'http://' } },
        { insert: 'list item 1' },
        { insert: '\n', attributes: { list: 'bullet' } },
        { insert: 'list item 1 indented' },
        { insert: '\n', attributes: { list: 'bullet', indent: 1 } },
      ];
      var qdc = new QuillDeltaToHtmlConverter(ops);

      it('should call before/after render callbacks ', function (done) {
        let status = { x: 0, y: 8 };
        qdc.beforeRender((groupType, data) => {
          if (groupType === GroupType.InlineGroup) {
            var op = (<any>data).ops[0];
            assert.ok(op.attributes.bold);
          } else if (groupType === GroupType.Video) {
            var op = (<any>data).op;
            assert.ok(op.insert.type === 'video');
          } else if (groupType === GroupType.Block) {
            var d = <any>data;
            assert.ok(d.op.attributes.blockquote && d.ops.length === 2);
          } else {
            var d = <any>data;
            assert.ok(d.items.length > 0);
          }
          status.x++;
          return '';
        });
        qdc.afterRender((groupType, html) => {
          if (groupType === GroupType.InlineGroup) {
            assert.ok(html.indexOf('<strong>hello') > -1);
          } else if (groupType === GroupType.Video) {
            assert.ok(html.indexOf('<iframe') > -1);
          } else if (groupType === GroupType.Block) {
            assert.ok(html.indexOf('<blockquote') > -1);
          } else {
            assert.ok(html.indexOf('list') > -1);
            assert.ok(html.indexOf('<li') > -1);
          }
          status.x++;
          return html;
        });
        qdc.convert();
        callWhenXEqualY(status, done);
      });

      it(`should call before render with block grouptype for align
                  indent and direction`, done => {
        let ops = [
          { insert: 'align' },
          { insert: '\n', attributes: { align: 'right' } },
          { insert: 'rtl' },
          { insert: '\n', attributes: { direction: 'rtl' } },
          { insert: 'indent 1' },
          { insert: '\n', attributes: { indent: 1 } },
        ];
        let status = { x: 0, y: 3 };
        let qdc = new QuillDeltaToHtmlConverter(ops);
        qdc.beforeRender((gtype: any) => {
          gtype === 'block' && status.x++;
          return '';
        });
        qdc.convert();
        callWhenXEqualY(status, done);
      });

      it('should use my custom html if I return from before call back', function () {
        var c = new QuillDeltaToHtmlConverter([{ insert: { video: 'http' } }, { insert: 'aa' }]);
        c.beforeRender(() => {
          return '<my custom video html>';
        });
        var v = c.convert();
        assert.ok(v.indexOf('<my custom') > -1);
      });

      it('should register and use callbacks if they are functions', function () {
        var c = new QuillDeltaToHtmlConverter([{ insert: { video: 'http' } }, { insert: 'aa' }]);
        var dummy = (): any => '';

        c.beforeRender(dummy());
        c.afterRender(dummy());
        v = c.convert();
        assert.ok(v.indexOf('iframe') > -1);

        c.beforeRender(dummy);
        var v = c.convert();
        assert.ok(v.indexOf('<iframe') > -1 && v.indexOf('aa') > -1);

        c.afterRender(dummy);
        v = c.convert();
        assert.ok(v === '');
      });
    });
  });
});
