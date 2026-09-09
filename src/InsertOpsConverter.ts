import { DeltaInsertOp } from './DeltaInsertOp';
import { DataType } from './value-types';
import { InsertData, InsertDataCustom, InsertDataQuill } from './InsertData';
import { OpAttributeSanitizer, IOpAttributeSanitizerOptions } from './OpAttributeSanitizer';
import { InsertOpDenormalizer } from './InsertOpDenormalizer';
import { OpLinkSanitizer } from './OpLinkSanitizer';

/**
 * Converts raw delta insert ops to array of denormalized DeltaInsertOp objects
 */
class InsertOpsConverter {
  static convert(deltaOps: null | any[], options: IOpAttributeSanitizerOptions): DeltaInsertOp[] {
    if (!Array.isArray(deltaOps)) {
      return [];
    }

    const results: DeltaInsertOp[] = [];

    for (let i = 0; i < deltaOps.length; i++) {
      const denormalizedOps = InsertOpDenormalizer.denormalize(deltaOps[i]);
      for (let j = 0; j < denormalizedOps.length; j++) {
        const op = denormalizedOps[j];
        if (!op.insert) {
          continue;
        }
        const insertVal = InsertOpsConverter.convertInsertVal(op.insert, options);
        if (!insertVal) {
          continue;
        }
        const attributes = OpAttributeSanitizer.sanitize(op.attributes, options);
        results.push(new DeltaInsertOp(insertVal, attributes));
      }
    }
    return results;
  }

  static convertInsertVal(insertPropVal: any, sanitizeOptions: IOpAttributeSanitizerOptions): InsertData | null {
    if (typeof insertPropVal === 'string') {
      return new InsertDataQuill(DataType.Text, insertPropVal);
    }

    if (!insertPropVal || typeof insertPropVal !== 'object') {
      return null;
    }

    let keys = Object.keys(insertPropVal);
    if (!keys.length) {
      return null;
    }

    return DataType.Image in insertPropVal
      ? new InsertDataQuill(
          DataType.Image,
          OpLinkSanitizer.sanitize(insertPropVal[DataType.Image] + '', sanitizeOptions)
        )
      : DataType.Video in insertPropVal
        ? new InsertDataQuill(
            DataType.Video,
            OpLinkSanitizer.sanitize(insertPropVal[DataType.Video] + '', sanitizeOptions)
          )
        : DataType.Formula in insertPropVal
          ? new InsertDataQuill(DataType.Formula, insertPropVal[DataType.Formula])
          : // custom
            new InsertDataCustom(keys[0], insertPropVal[keys[0]]);
  }
}

export { InsertOpsConverter };
