import { type RawRecord } from '../../../types/RawRecord';
import { type ParseContext } from '../../types/ParseContext';

export interface RecordParser {
  readonly type: string;
  parse(record: RawRecord, ctx: ParseContext): void;
}
