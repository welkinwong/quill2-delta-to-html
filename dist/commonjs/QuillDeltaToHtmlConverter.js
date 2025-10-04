"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
var InsertOpsConverter_1 = require("./InsertOpsConverter");
var OpToHtmlConverter_1 = require("./OpToHtmlConverter");
var Grouper_1 = require("./grouper/Grouper");
var group_types_1 = require("./grouper/group-types");
var ListGrouper_1 = require("./grouper/ListGrouper");
var funcs_html_1 = require("./funcs-html");
var obj = __importStar(require("./helpers/object"));
var value_types_1 = require("./value-types");
var TableGrouper_1 = require("./grouper/TableGrouper");
var CodeBlockGrouper_1 = require("./grouper/CodeBlockGrouper");
var BrTag = '<br/>';
var QuillDeltaToHtmlConverter = (function () {
    function QuillDeltaToHtmlConverter(deltaOps, options) {
        this.rawDeltaOps = [];
        this.callbacks = {};
        this.options = obj.assign({
            paragraphTag: 'p',
            encodeHtml: true,
            classPrefix: 'ql',
            inlineStyles: false,
            simpleCodeBlock: false,
            simpleList: false,
            allowBackgroundClasses: false,
            linkRel: 'noopener noreferrer',
            linkTarget: '_blank',
        }, options, {
            orderedListTag: 'ol',
            bulletListTag: options && options.simpleList ? 'ul' : 'ol',
            listItemTag: 'li',
        });
        var inlineStyles;
        if (!this.options.inlineStyles) {
            inlineStyles = undefined;
        }
        else if (typeof this.options.inlineStyles === 'object') {
            inlineStyles = this.options.inlineStyles;
        }
        else {
            inlineStyles = {};
        }
        this.converterOptions = {
            encodeHtml: this.options.encodeHtml,
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
    QuillDeltaToHtmlConverter.prototype._getListTag = function (op) {
        return op.isOrderedList()
            ? this.options.orderedListTag + ''
            : op.isBulletList()
                ? this.options.bulletListTag + ''
                : op.isCheckedList()
                    ? this.options.bulletListTag + ''
                    : op.isUncheckedList()
                        ? this.options.bulletListTag + ''
                        : '';
    };
    QuillDeltaToHtmlConverter.prototype.getGroupedOps = function () {
        var deltaOps = InsertOpsConverter_1.InsertOpsConverter.convert(this.rawDeltaOps, this.options);
        var pairedOps = Grouper_1.Grouper.pairOpsWithTheirBlock(deltaOps);
        var groupedOps = Grouper_1.Grouper.reduceConsecutiveSameStyleBlocksToOne(pairedOps);
        var tableGrouper = new TableGrouper_1.TableGrouper();
        groupedOps = tableGrouper.group(groupedOps);
        var codeBlockGrouper = new CodeBlockGrouper_1.CodeBlockGrouper();
        groupedOps = codeBlockGrouper.group(groupedOps);
        var listGrouper = new ListGrouper_1.ListGrouper();
        return listGrouper.group(groupedOps);
    };
    QuillDeltaToHtmlConverter.prototype.convert = function () {
        var _this = this;
        var groups = this.getGroupedOps();
        return groups
            .map(function (group) {
            if (group instanceof group_types_1.CodeBlockGroup) {
                return _this._renderWithCallbacks(value_types_1.GroupType.CodeBlock, group, function () {
                    return _this._renderCodeBlock(group);
                });
            }
            else if (group instanceof group_types_1.ListGroup) {
                return _this._renderWithCallbacks(value_types_1.GroupType.List, group, function () { return _this._renderList(group); });
            }
            else if (group instanceof group_types_1.TableGroup) {
                return _this._renderWithCallbacks(value_types_1.GroupType.Table, group, function () { return _this._renderTable(group); });
            }
            else if (group instanceof group_types_1.BlockGroup) {
                var g = group;
                return _this._renderWithCallbacks(value_types_1.GroupType.Block, group, function () { return _this._renderBlock(g.op, g.ops); });
            }
            else if (group instanceof group_types_1.BlotBlock) {
                return _this._renderCustom(group.op, null);
            }
            else if (group instanceof group_types_1.VideoItem) {
                return _this._renderWithCallbacks(value_types_1.GroupType.Video, group, function () {
                    var g = group;
                    var converter = new OpToHtmlConverter_1.OpToHtmlConverter(g.op, _this.converterOptions);
                    return converter.getHtml();
                });
            }
            else {
                return _this._renderWithCallbacks(value_types_1.GroupType.InlineGroup, group, function () {
                    return _this._renderInlines(group.ops, true);
                });
            }
        })
            .join('');
    };
    QuillDeltaToHtmlConverter.prototype._renderWithCallbacks = function (groupType, group, myRenderFn) {
        var html = '';
        var beforeCb = this.callbacks['beforeRender_cb'];
        html = typeof beforeCb === 'function' ? beforeCb.apply(null, [groupType, group]) : '';
        if (!html) {
            html = myRenderFn();
        }
        var afterCb = this.callbacks['afterRender_cb'];
        html = typeof afterCb === 'function' ? afterCb.apply(null, [groupType, html]) : html;
        return html;
    };
    QuillDeltaToHtmlConverter.prototype._renderCodeBlock = function (codeBlockGroup) {
        var _this = this;
        var tag = this.options.simpleCodeBlock ? 'pre' : 'div';
        return (funcs_html_1.makeStartTag(tag, this.options.simpleCodeBlock
            ? undefined
            : {
                key: 'class',
                value: this.options.classPrefix + "-code-block-container",
            }) +
            codeBlockGroup.items
                .map(function (codeBlock, index) { return _this._renderCodeBlockItem(codeBlock, index === codeBlockGroup.items.length - 1); })
                .join('') +
            funcs_html_1.makeEndTag(tag));
    };
    QuillDeltaToHtmlConverter.prototype._renderCodeBlockItem = function (codeBlock, isLast) {
        var converter = new OpToHtmlConverter_1.OpToHtmlConverter(codeBlock.item.op, this.converterOptions);
        var parts = converter.getHtmlParts();
        var codeBlockElementsHtml = funcs_html_1.encodeHtml(codeBlock.item.ops.map(function (iop) { return iop.insert.value; }).join(''));
        if (this.options.simpleCodeBlock) {
            return codeBlockElementsHtml + (isLast ? '' : BrTag);
        }
        else {
            return parts.openingTag + codeBlockElementsHtml + parts.closingTag;
        }
    };
    QuillDeltaToHtmlConverter.prototype._renderList = function (list) {
        var _this = this;
        var firstItem = list.items[0];
        return (funcs_html_1.makeStartTag(this._getListTag(firstItem.item.op)) +
            list.items.map(function (li) { return _this._renderListItem(li); }).join('') +
            funcs_html_1.makeEndTag(this._getListTag(firstItem.item.op)));
    };
    QuillDeltaToHtmlConverter.prototype._renderListItem = function (li) {
        var converter = new OpToHtmlConverter_1.OpToHtmlConverter(li.item.op, this.converterOptions);
        var parts = converter.getHtmlParts();
        var prefixHtml = this.options.simpleList ? '' : '<span class="ql-ui" contenteditable="false"></span>';
        var liElementsHtml = this._renderInlines(li.item.ops, false);
        return parts.openingTag + prefixHtml + liElementsHtml + parts.closingTag;
    };
    QuillDeltaToHtmlConverter.prototype._renderTable = function (table) {
        var _this = this;
        return (funcs_html_1.makeStartTag('table') +
            funcs_html_1.makeStartTag('tbody') +
            table.rows.map(function (row) { return _this._renderTableRow(row); }).join('') +
            funcs_html_1.makeEndTag('tbody') +
            funcs_html_1.makeEndTag('table'));
    };
    QuillDeltaToHtmlConverter.prototype._renderTableRow = function (row) {
        var _this = this;
        return (funcs_html_1.makeStartTag('tr') + row.cells.map(function (cell) { return _this._renderTableCell(cell); }).join('') + funcs_html_1.makeEndTag('tr'));
    };
    QuillDeltaToHtmlConverter.prototype._renderTableCell = function (cell) {
        var converter = new OpToHtmlConverter_1.OpToHtmlConverter(cell.item.op, this.converterOptions);
        var parts = converter.getHtmlParts();
        var cellElementsHtml = this._renderInlines(cell.item.ops, false);
        return (funcs_html_1.makeStartTag('td', {
            key: 'data-row',
            value: cell.item.op.attributes.table,
        }) +
            parts.openingTag +
            cellElementsHtml +
            parts.closingTag +
            funcs_html_1.makeEndTag('td'));
    };
    QuillDeltaToHtmlConverter.prototype._renderBlock = function (bop, ops) {
        var _this = this;
        var converter = new OpToHtmlConverter_1.OpToHtmlConverter(bop, this.converterOptions);
        var htmlParts = converter.getHtmlParts();
        if (bop.isCodeBlock()) {
            return (htmlParts.openingTag +
                funcs_html_1.encodeHtml(ops.map(function (iop) { return (iop.isCustomEmbed() ? _this._renderCustom(iop, bop) : iop.insert.value); }).join('')) +
                htmlParts.closingTag);
        }
        var inlines = ops.map(function (op) { return _this._renderInline(op, bop); }).join('');
        return htmlParts.openingTag + (inlines || BrTag) + htmlParts.closingTag;
    };
    QuillDeltaToHtmlConverter.prototype._renderInlines = function (ops, isInlineGroup) {
        var _this = this;
        if (isInlineGroup === void 0) { isInlineGroup = true; }
        var opsLen = ops.length - 1;
        var html = ops
            .map(function (op, i) {
            if (i > 0 && i === opsLen && op.isJustNewline()) {
                return '';
            }
            return _this._renderInline(op, null);
        })
            .join('');
        if (!isInlineGroup) {
            return html;
        }
        var startParaTag = funcs_html_1.makeStartTag(this.options.paragraphTag);
        var endParaTag = funcs_html_1.makeEndTag(this.options.paragraphTag);
        if (html === BrTag) {
            return startParaTag + html + endParaTag;
        }
        return (startParaTag +
            html
                .split(BrTag)
                .map(function (v) {
                return v === '' ? BrTag : v;
            })
                .join(endParaTag + startParaTag) +
            endParaTag);
    };
    QuillDeltaToHtmlConverter.prototype._renderInline = function (op, contextOp) {
        if (op.isCustomEmbed()) {
            return this._renderCustom(op, contextOp);
        }
        var converter = new OpToHtmlConverter_1.OpToHtmlConverter(op, this.converterOptions);
        return converter.getHtml().replace(/\n/g, BrTag);
    };
    QuillDeltaToHtmlConverter.prototype._renderCustom = function (op, contextOp) {
        var renderCb = this.callbacks['renderCustomOp_cb'];
        if (typeof renderCb === 'function') {
            return renderCb.apply(null, [op, contextOp]);
        }
        return '';
    };
    QuillDeltaToHtmlConverter.prototype.beforeRender = function (cb) {
        if (typeof cb === 'function') {
            this.callbacks['beforeRender_cb'] = cb;
        }
    };
    QuillDeltaToHtmlConverter.prototype.afterRender = function (cb) {
        if (typeof cb === 'function') {
            this.callbacks['afterRender_cb'] = cb;
        }
    };
    QuillDeltaToHtmlConverter.prototype.renderCustomWith = function (cb) {
        this.callbacks['renderCustomOp_cb'] = cb;
    };
    return QuillDeltaToHtmlConverter;
}());
exports.QuillDeltaToHtmlConverter = QuillDeltaToHtmlConverter;
