import { type RawRecord } from '../../types/RawRecord';
import { type ParseContext } from '../types/ParseContext';
import { type RecordParser } from './types/RecordParser';

export class GParser implements RecordParser {
  readonly type = 'G';

  parse(record: RawRecord, ctx: ParseContext): void {
    const f = record.fields;

    const conceptCode = f[0]?.[0] ?? '';
    const filename = f[1]?.[0] ?? '';

    if (!conceptCode) {
      ctx.diagnostics.push({
        level: 'warn',
        code: 'BC3_G_MISSING_CODE',
        message: 'Record ~G without concept code.',
        recordIndex: record.index,
        recordType: record.type,
      });
      return;
    }

    if (!filename) {
      ctx.diagnostics.push({
        level: 'warn',
        code: 'BC3_G_MISSING_FILENAME',
        message: `Record ~G for concept "${conceptCode}" without filename.`,
        recordIndex: record.index,
        recordType: record.type,
      });
      return;
    }

    ctx.builder.onG({ conceptCode, filename });
  }
}
