import { ListGroup, ListItem, BlockGroup, TDataGroup } from './group-types';
import { groupConsecutiveElementsWhile } from '../helpers/array';

export class ListGrouper {
  group(groups: TDataGroup[]): TDataGroup[] {
    var listBlocked = this.convertListBlocksToListGroups(groups);
    return listBlocked;
  }

  private convertListBlocksToListGroups(items: TDataGroup[]): Array<TDataGroup> {
    var grouped = groupConsecutiveElementsWhile(items, (g: TDataGroup, gPrev: TDataGroup) => {
      return (
        g instanceof BlockGroup &&
        gPrev instanceof BlockGroup &&
        g.op.isList() &&
        gPrev.op.isList() &&
        g.op.isSameListAs(gPrev.op)
      );
    });

    return grouped.map((item: TDataGroup | BlockGroup[]) => {
      if (!Array.isArray(item)) {
        if (item instanceof BlockGroup && item.op.isList()) {
          return new ListGroup([new ListItem(item)]);
        }
        return item;
      }
      return new ListGroup(item.map(g => new ListItem(g)));
    });
  }
}
