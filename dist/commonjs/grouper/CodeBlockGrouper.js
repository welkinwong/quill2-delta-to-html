"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var group_types_1 = require("./group-types");
var array_1 = require("../helpers/array");
var CodeBlockGrouper = (function () {
    function CodeBlockGrouper() {
    }
    CodeBlockGrouper.prototype.group = function (groups) {
        var codeBlocked = this.convertCodeBlocksToCodeBlockGroups(groups);
        return codeBlocked;
    };
    CodeBlockGrouper.prototype.convertCodeBlocksToCodeBlockGroups = function (items) {
        var grouped = array_1.groupConsecutiveElementsWhile(items, function (g, gPrev) {
            return (g instanceof group_types_1.BlockGroup &&
                gPrev instanceof group_types_1.BlockGroup &&
                g.op.isCodeBlock() &&
                gPrev.op.isCodeBlock() &&
                g.op.isSameCodeBlockAs(gPrev.op));
        });
        return grouped.map(function (item) {
            if (!Array.isArray(item)) {
                if (item instanceof group_types_1.BlockGroup && item.op.isCodeBlock()) {
                    return new group_types_1.CodeBlockGroup([new group_types_1.CodeBlockItem(item)]);
                }
                return item;
            }
            return new group_types_1.CodeBlockGroup(item.map(function (g) { return new group_types_1.CodeBlockItem(g); }));
        });
    };
    return CodeBlockGrouper;
}());
exports.CodeBlockGrouper = CodeBlockGrouper;
