import { InsertOpsConverter } from './InsertOpsConverter';
import { OpToHtmlConverter, IOpToHtmlConverterOptions, IInlineStyles, IHtmlParts } from './OpToHtmlConverter';
import { DeltaInsertOp } from './DeltaInsertOp';
import { Grouper } from './grouper/Grouper';
import {
  VideoItem,
  InlineGroup,
  BlockGroup,
  ListGroup,
  ListItem,
  TDataGroup,
  BlotBlock,
  TableGroup,
  TableRow,
  TableCell,
  CodeBlockGroup,
  CodeBlockItem,
} from './grouper/group-types';
import { ListGrouper } from './grouper/ListGrouper';
import { makeStartTag, makeEndTag, encodeHtml } from './funcs-html';
import * as obj from './helpers/object';
import { GroupType } from './value-types';
import { IOpAttributeSanitizerOptions } from './OpAttributeSanitizer';
import { TableGrouper } from './grouper/TableGrouper';
import { CodeBlockGrouper } from './grouper/CodeBlockGrouper';

interface IQuillDeltaToHtmlConverterOptions extends IOpAttributeSanitizerOptions, IOpToHtmlConverterOptions {
  orderedListTag?: string;
  bulletListTag?: string;
  simpleCodeBlock?: boolean;
  simpleList?: boolean;
}

type RichNode = {
  openingTag: string;
  closingTag: string;
  children: Array<RichNode | string>;
};

const BrTag = '<br/>';

class QuillDeltaToHtmlConverter {
  private options: IQuillDeltaToHtmlConverterOptions;
  private rawDeltaOps: any[] = [];
  private converterOptions: IOpToHtmlConverterOptions;
  private reusableOpConverter: OpToHtmlConverter | null = null;

  // render callbacks
  private callbacks: any = {};

  constructor(deltaOps: any[], options?: IQuillDeltaToHtmlConverterOptions) {
    this.options = obj.assign(
      {
        paragraphTag: 'p',
        encodeSpace: true,
        encodeHtml: true,
        classPrefix: 'ql',
        inlineStyles: false,
        simpleCodeBlock: false,
        simpleList: false,
        allowBackgroundClasses: false,
        linkRel: 'noopener noreferrer',
        linkTarget: '_blank',
      },
      options,
      {
        orderedListTag: 'ol',
        bulletListTag: options && options.simpleList ? 'ul' : 'ol',
        listItemTag: 'li',
      }
    );

    var inlineStyles: IInlineStyles | undefined;
    if (!this.options.inlineStyles) {
      inlineStyles = undefined;
    } else if (typeof this.options.inlineStyles === 'object') {
      inlineStyles = this.options.inlineStyles;
    } else {
      inlineStyles = {};
    }

    this.converterOptions = {
      encodeHtml: this.options.encodeHtml,
      encodeSpace: this.options.encodeSpace,
      classPrefix: this.options.classPrefix,
      inlineStyles: inlineStyles,
      simpleCodeBlock: this.options.simpleCodeBlock,
      simpleList: this.options.simpleList,
      listItemTag: this.options.listItemTag,
      paragraphTag: this.options.paragraphTag,
      linkRel: this.options.linkRel,
      linkTarget: this.options.linkTarget,
      allowBackgroundClasses: this.options.allowBackgroundClasses,
      customTag: this.options.customTag,
      customTagAttributes: this.options.customTagAttributes,
      customCssClasses: this.options.customCssClasses,
      customCssStyles: this.options.customCssStyles,
    };
    this.rawDeltaOps = deltaOps;
  }

  _getListTag(op: DeltaInsertOp): string {
    return op.isOrderedList()
      ? this.options.orderedListTag + ''
      : op.isBulletList()
        ? this.options.bulletListTag + ''
        : op.isCheckedList()
          ? this.options.bulletListTag + ''
          : op.isUncheckedList()
            ? this.options.bulletListTag + ''
            : '';
  }

  getGroupedOps(): TDataGroup[] {
    var deltaOps = InsertOpsConverter.convert(this.rawDeltaOps, this.options);

    var pairedOps = Grouper.pairOpsWithTheirBlock(deltaOps);

    var groupedOps = Grouper.reduceConsecutiveSameStyleBlocksToOne(pairedOps);

    var tableGrouper = new TableGrouper();
    groupedOps = tableGrouper.group(groupedOps);

    var codeBlockGrouper = new CodeBlockGrouper();
    groupedOps = codeBlockGrouper.group(groupedOps);

    var listGrouper = new ListGrouper();
    return listGrouper.group(groupedOps);
  }

  convert() {
    let groups = this.getGroupedOps();
    return groups
      .map(group => {
        if (group instanceof CodeBlockGroup) {
          return this._renderWithCallbacks(GroupType.CodeBlock, group, () =>
            this._renderCodeBlock(<CodeBlockGroup>group)
          );
        } else if (group instanceof ListGroup) {
          return this._renderWithCallbacks(GroupType.List, group, () => this._renderList(<ListGroup>group));
        } else if (group instanceof TableGroup) {
          return this._renderWithCallbacks(GroupType.Table, group, () => this._renderTable(<TableGroup>group));
        } else if (group instanceof BlockGroup) {
          var g = <BlockGroup>group;

          return this._renderWithCallbacks(GroupType.Block, group, () => this._renderBlock(g.op, g.ops));
        } else if (group instanceof BlotBlock) {
          return this._renderCustom(group.op, null);
        } else if (group instanceof VideoItem) {
          return this._renderWithCallbacks(GroupType.Video, group, () => {
            var g = <VideoItem>group;
            var converter = this._getReusableConverter(g.op);
            return converter.getHtml();
          });
        } else {
          // InlineGroup
          return this._renderWithCallbacks(GroupType.InlineGroup, group, () => {
            return this._renderInlines((<InlineGroup>group).ops, true);
          });
        }
      })
      .join('');
  }

  _getReusableConverter(op: DeltaInsertOp) {
    if (!this.reusableOpConverter) {
      this.reusableOpConverter = new OpToHtmlConverter(op, this.converterOptions);
      return this.reusableOpConverter;
    }
    return this.reusableOpConverter.setOp(op);
  }

  _renderWithCallbacks(groupType: GroupType, group: TDataGroup, myRenderFn: () => string) {
    var html = '';
    var beforeCb = this.callbacks['beforeRender_cb'];
    html = typeof beforeCb === 'function' ? beforeCb.apply(null, [groupType, group]) : '';

    if (!html) {
      html = myRenderFn();
    }

    var afterCb = this.callbacks['afterRender_cb'];
    html = typeof afterCb === 'function' ? afterCb.apply(null, [groupType, html]) : html;

    return html;
  }

  _renderCodeBlock(codeBlockGroup: CodeBlockGroup): string {
    const tag = this.options.simpleCodeBlock ? 'pre' : 'div';

    return (
      makeStartTag(
        tag,
        this.options.simpleCodeBlock
          ? undefined
          : {
              key: 'class',
              value: `${this.options.classPrefix}-code-block-container`,
            }
      ) +
      codeBlockGroup.items
        .map((codeBlock, index) => this._renderCodeBlockItem(codeBlock, index === codeBlockGroup.items.length - 1))
        .join('') +
      makeEndTag(tag)
    );
  }

  /**
   * Encode one code-block line. Grouper fills empty lines with NewLine; that is a
   * placeholder, not content. Strip it so Quill-format HTML can use <br/> and
   * simpleCodeBlock does not emit both "\n" and <br/>.
   */
  _encodeCodeBlockLineHtml(raw: string): string {
    return encodeHtml(raw.replace(/\r?\n/g, ''), {
      encodeSpace: this.options.encodeSpace !== false,
    });
  }

  _renderCodeBlockItem(codeBlock: CodeBlockItem, isLast: boolean): string {
    var converter = this._getReusableConverter(codeBlock.item.op);
    var parts = converter.getHtmlParts();
    var lineHtml = this._encodeCodeBlockLineHtml(codeBlock.item.ops.map(iop => iop.insert.value).join(''));

    if (this.options.simpleCodeBlock) {
      return lineHtml + (isLast ? '' : BrTag);
    }

    return parts.openingTags.join('') + (lineHtml || BrTag) + parts.closingTags.join('');
  }

  _renderList(list: ListGroup): string {
    var firstItem = list.items[0];
    return (
      makeStartTag(this._getListTag(firstItem.item.op)) +
      list.items.map((li: ListItem) => this._renderListItem(li)).join('') +
      makeEndTag(this._getListTag(firstItem.item.op))
    );
  }

  _renderListItem(li: ListItem): string {
    var converter = this._getReusableConverter(li.item.op);
    var parts = converter.getHtmlParts();
    var prefixHtml = this.options.simpleList ? '' : '<span class="ql-ui" contenteditable="false"></span>';
    var liElementsHtml = this._renderInlines(li.item.ops, false);
    return parts.openingTags.join('') + prefixHtml + liElementsHtml + parts.closingTags.join('');
  }

  _renderTable(table: TableGroup): string {
    return (
      makeStartTag('table') +
      makeStartTag('tbody') +
      table.rows.map((row: TableRow) => this._renderTableRow(row)).join('') +
      makeEndTag('tbody') +
      makeEndTag('table')
    );
  }

  _renderTableRow(row: TableRow): string {
    return (
      makeStartTag('tr') + row.cells.map((cell: TableCell) => this._renderTableCell(cell)).join('') + makeEndTag('tr')
    );
  }

  _renderTableCell(cell: TableCell): string {
    var converter = this._getReusableConverter(cell.item.op);
    var parts = converter.getHtmlParts();
    var cellElementsHtml = this._renderInlines(cell.item.ops, false);
    return (
      makeStartTag('td', {
        key: 'data-row',
        value: cell.item.op.attributes.table,
      }) +
      parts.openingTags.join('') +
      cellElementsHtml +
      parts.closingTags.join('') +
      makeEndTag('td')
    );
  }

  _renderBlock(bop: DeltaInsertOp, ops: DeltaInsertOp[]) {
    var converter = this._getReusableConverter(bop);
    var htmlParts = converter.getHtmlParts();

    if (bop.isCodeBlock()) {
      var lineHtml = this._encodeCodeBlockLineHtml(
        ops.map(iop => (iop.isCustomEmbed() ? this._renderCustom(iop, bop) : iop.insert.value)).join('')
      );
      return htmlParts.openingTags.join('') + (lineHtml || BrTag) + htmlParts.closingTags.join('');
    }

    var inlines = this._renderInlines(ops, false);
    return htmlParts.openingTags.join('') + (inlines || BrTag) + htmlParts.closingTags.join('');
  }

  _mergeInlines(parts: IHtmlParts[]): Array<RichNode | string> {
    const root = { children: [] as Array<RichNode | string> };
    const stack: Array<{ node: RichNode | typeof root; tag?: string }> = [{ node: root }];
    let currentPath: string[] = [];

    const appendChild = (list: Array<RichNode | string>, value: string | RichNode) => {
      if (typeof value === 'string' && value) {
        const last = list[list.length - 1];
        if (typeof last === 'string') {
          list[list.length - 1] = last + value;
          return;
        }
      }
      list.push(value);
    };

    for (const { openingTags = [], closingTags = [], content } of parts) {
      let common = 0;
      while (
        common < openingTags.length &&
        common < currentPath.length &&
        openingTags[common] === currentPath[common]
      ) {
        common++;
      }
      while (currentPath.length > common) {
        stack.pop();
        currentPath.pop();
      }
      for (let i = common; i < openingTags.length; i++) {
        const closingIndex = closingTags.length ? closingTags.length - 1 - i : -1;
        const node: RichNode = {
          openingTag: openingTags[i],
          closingTag: closingIndex >= 0 ? closingTags[closingIndex] || '' : '',
          children: [],
        };
        appendChild(stack[stack.length - 1].node.children, node);
        stack.push({ node, tag: openingTags[i] });
        currentPath.push(openingTags[i]);
      }
      appendChild(stack[stack.length - 1].node.children, content);
    }

    return root.children;
  }

  _renderInlines(ops: DeltaInsertOp[], isInlineGroup = true) {
    const inlines: IHtmlParts[] = [];
    for (let i = 0; i < ops.length; i++) {
      const op = ops[i];
      if (i > 0 && i === ops.length - 1 && op.isJustNewline()) continue;

      const part = this._renderInline(op, null);
      if (part !== undefined) inlines.push(part);
    }

    const htmlParts = this._mergeInlines(inlines);

    function renderRichNode(node: RichNode | string): string {
      if (typeof node === 'string') return node;
      let childrenHtml = '';
      for (let i = 0; i < node.children.length; i++) {
        childrenHtml += renderRichNode(node.children[i]);
      }
      return node.openingTag + childrenHtml + node.closingTag;
    }

    const html = htmlParts
      .map(part => renderRichNode(part))
      .join('')
      .replace(/\n/g, BrTag);

    if (!isInlineGroup) {
      return html;
    }

    let startParaTag = makeStartTag(this.options.paragraphTag);
    let endParaTag = makeEndTag(this.options.paragraphTag);

    if (html === BrTag) {
      return startParaTag + html + endParaTag;
    }

    let segmented = '';
    let index = 0;
    let first = true;
    while (index <= html.length) {
      const brIndex = html.indexOf(BrTag, index);
      const hasBr = brIndex !== -1;
      const segment = hasBr ? html.slice(index, brIndex) : html.slice(index);
      if (!first) {
        segmented += endParaTag + startParaTag;
      }
      segmented += segment === '' ? BrTag : segment;
      first = false;
      if (!hasBr) {
        break;
      }
      index = brIndex + BrTag.length;
    }

    return startParaTag + segmented + endParaTag;
  }

  _renderInline(op: DeltaInsertOp, contextOp: DeltaInsertOp | null) {
    if (op.isCustomEmbed()) {
      const converter = this._getReusableConverter(op);
      const parts = converter.getHtmlParts();
      parts.content = this._renderCustom(op, contextOp);
      return parts;
    }
    var converter = this._getReusableConverter(op);

    return converter.getHtmlParts();
  }

  _renderCustom(op: DeltaInsertOp, contextOp: DeltaInsertOp | null) {
    var renderCb = this.callbacks['renderCustomOp_cb'];
    if (typeof renderCb === 'function') {
      return renderCb.apply(null, [op, contextOp]);
    }
    return '';
  }

  beforeRender(cb: (group: GroupType, data: TDataGroup) => string) {
    if (typeof cb === 'function') {
      this.callbacks['beforeRender_cb'] = cb;
    }
  }

  afterRender(cb: (group: GroupType, html: string) => string) {
    if (typeof cb === 'function') {
      this.callbacks['afterRender_cb'] = cb;
    }
  }

  renderCustomWith(cb: (op: DeltaInsertOp, contextOp: DeltaInsertOp) => string) {
    this.callbacks['renderCustomOp_cb'] = cb;
  }
}

export { QuillDeltaToHtmlConverter };
