import 'mocha';
import * as assert from 'assert';

import { Grouper } from './../../src/grouper/Grouper';
import { DeltaInsertOp } from './../../src/DeltaInsertOp';
import { InsertDataQuill } from './../../src/InsertData';
import { VideoItem, InlineGroup, BlockGroup } from './../../src/grouper/group-types';
import { DataType } from './../../src/value-types';
describe('Grouper', function () {
  describe('#pairOpsWithTheirBlock()', function () {
    var ops = [
      new DeltaInsertOp(new InsertDataQuill(DataType.Video, 'http://')),
      new DeltaInsertOp('hello'),
      new DeltaInsertOp('\n'),
      new DeltaInsertOp('how are you?'),
      new DeltaInsertOp('\n'),
      new DeltaInsertOp('Time is money'),
      new DeltaInsertOp('\n', { blockquote: true }),
    ];
    it('should return ops grouped by group type', function () {
      var act = Grouper.pairOpsWithTheirBlock(ops);
      // Each \n is a block boundary in Quill Delta, so "hello\n" and "how are you?\n" form separate InlineGroups.
      var exp = [
        new VideoItem(ops[0]),
        new InlineGroup([ops[1], ops[2]]),
        new InlineGroup([ops[3], ops[4]]),
        new BlockGroup(ops[6], [ops[5]]),
      ];
      assert.deepEqual(act, exp);
    });
  });
});
