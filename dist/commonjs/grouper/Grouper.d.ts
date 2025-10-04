import { DeltaInsertOp } from './../DeltaInsertOp';
import { BlockGroup, TDataGroup } from './group-types';
declare class Grouper {
  static pairOpsWithTheirBlock(ops: DeltaInsertOp[]): TDataGroup[];
  static reduceConsecutiveSameStyleBlocksToOne(groups: Array<TDataGroup | BlockGroup[]>): TDataGroup[];
  static areBothCodeblocksWithSameLang(g1: BlockGroup, gOther: BlockGroup): boolean;
  static areBothSameHeadersWithSameAdi(g1: BlockGroup, gOther: BlockGroup): boolean;
  static areBothBlockquotesWithSameAdi(g: BlockGroup, gOther: BlockGroup): boolean;
  static areBothCustomBlockWithSameAttr(g: BlockGroup, gOther: BlockGroup): boolean;
}
export { Grouper };
