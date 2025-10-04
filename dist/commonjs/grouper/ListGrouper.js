"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var group_types_1 = require("./group-types");
var array_1 = require("../helpers/array");
var ListGrouper = (function () {
    function ListGrouper() {
    }
    ListGrouper.prototype.group = function (groups) {
        var listBlocked = this.convertListBlocksToListGroups(groups);
        return listBlocked;
    };
    ListGrouper.prototype.convertListBlocksToListGroups = function (items) {
        var grouped = array_1.groupConsecutiveElementsWhile(items, function (g, gPrev) {
            return (g instanceof group_types_1.BlockGroup &&
                gPrev instanceof group_types_1.BlockGroup &&
                g.op.isList() &&
                gPrev.op.isList() &&
                g.op.isSameListAs(gPrev.op));
        });
        return grouped.map(function (item) {
            if (!Array.isArray(item)) {
                if (item instanceof group_types_1.BlockGroup && item.op.isList()) {
                    return new group_types_1.ListGroup([new group_types_1.ListItem(item)]);
                }
                return item;
            }
            return new group_types_1.ListGroup(item.map(function (g) { return new group_types_1.ListItem(g); }));
        });
    };
    return ListGrouper;
}());
exports.ListGrouper = ListGrouper;
