import { BlockGroup, TDataGroup, CodeBlockGroup, CodeBlockItem } from './group-types';
import { groupConsecutiveElementsWhile } from '../helpers/array';

export class CodeBlockGrouper {
  group(groups: TDataGroup[]): TDataGroup[] {
    var codeBlocked = this.convertCodeBlocksToCodeBlockGroups(groups);
    return codeBlocked;
  }

  private convertCodeBlocksToCodeBlockGroups(items: TDataGroup[]): Array<TDataGroup> {
    var grouped = groupConsecutiveElementsWhile(items, (g: TDataGroup, gPrev: TDataGroup) => {
      return (
        g instanceof BlockGroup &&
        gPrev instanceof BlockGroup &&
        g.op.isCodeBlock() &&
        gPrev.op.isCodeBlock() &&
        g.op.isSameCodeBlockAs(gPrev.op)
      );
    });

    return grouped.map((item: TDataGroup | BlockGroup[]) => {
      if (!Array.isArray(item)) {
        if (item instanceof BlockGroup && item.op.isCodeBlock()) {
          return new CodeBlockGroup([new CodeBlockItem(item)]);
        }
        return item;
      }
      return new CodeBlockGroup(item.map(g => new CodeBlockItem(g)));
    });
  }
}
