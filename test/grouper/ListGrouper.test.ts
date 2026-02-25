import 'mocha';
import * as assert from 'assert';

import { Grouper } from './../../src/grouper/Grouper';
import { ListGrouper } from './../../src/grouper/ListGrouper';
import { DeltaInsertOp } from './../../src/DeltaInsertOp';
import { ListGroup, ListItem, InlineGroup, BlockGroup } from './../../src/grouper/group-types';
import { ListType } from './../../src/value-types';

describe('ListGrouper', function () {
  describe('group()', function () {
    it('should not group different types of lists', function () {
      var ops = [
        new DeltaInsertOp('ordered list 1 item 1'),
        new DeltaInsertOp('\n', { list: ListType.Ordered }),
        new DeltaInsertOp('bullet list 1 item 1'),
        new DeltaInsertOp('\n', { list: ListType.Bullet }),
        new DeltaInsertOp('bullet list 1 item 2'),
        new DeltaInsertOp('\n', { list: ListType.Bullet }),
        new DeltaInsertOp('haha'),
        new DeltaInsertOp('\n'),
        new DeltaInsertOp('\n', { list: ListType.Bullet }),
        new DeltaInsertOp('\n', { list: ListType.Checked }),
        new DeltaInsertOp('\n', { list: ListType.Unchecked }),
      ];

      var groups = Grouper.pairOpsWithTheirBlock(ops);
      var grouper = new ListGrouper();
      var act = grouper.group(groups);

      assert.deepEqual(act, [
        new ListGroup([new ListItem(<BlockGroup>groups[0])]),
        new ListGroup([new ListItem(<BlockGroup>groups[1]), new ListItem(<BlockGroup>groups[2])]),
        new InlineGroup([ops[6], ops[7]]),
        new ListGroup([new ListItem(new BlockGroup(ops[8], []))]),
        new ListGroup([new ListItem(new BlockGroup(ops[9], [])), new ListItem(new BlockGroup(ops[10], []))]),
      ]);
    });

    it('should group consecutive same-type lists regardless of indent', function () {
      var ops = [
        new DeltaInsertOp('item 1'),
        new DeltaInsertOp('\n', { list: ListType.Ordered }),
        new DeltaInsertOp('item 1a'),
        new DeltaInsertOp('\n', { list: ListType.Ordered, indent: 1 }),
        new DeltaInsertOp('item 1a-i'),
        new DeltaInsertOp('\n', { list: ListType.Ordered, indent: 3 }),
        new DeltaInsertOp('item 1b'),
        new DeltaInsertOp('\n', { list: ListType.Ordered, indent: 1 }),
        new DeltaInsertOp('item 2'),
        new DeltaInsertOp('\n', { list: ListType.Ordered }),
        new DeltaInsertOp('haha'),
        new DeltaInsertOp('\n'),
        new DeltaInsertOp('\n', { list: ListType.Ordered, indent: 5 }),
        new DeltaInsertOp('\n', { list: ListType.Bullet, indent: 4 }),
      ];
      var pairs = Grouper.pairOpsWithTheirBlock(ops);

      var grouper = new ListGrouper();
      var act = grouper.group(pairs);

      assert.deepEqual(act, [
        new ListGroup([
          new ListItem(<BlockGroup>pairs[0]),
          new ListItem(<BlockGroup>pairs[1]),
          new ListItem(<BlockGroup>pairs[2]),
          new ListItem(<BlockGroup>pairs[3]),
          new ListItem(<BlockGroup>pairs[4]),
        ]),
        new InlineGroup([ops[10], ops[11]]),
        new ListGroup([new ListItem(new BlockGroup(ops[12], []))]),
        new ListGroup([new ListItem(new BlockGroup(ops[13], []))]),
      ]);
    });
  });
});
