import { type ParseOptions } from '../../../api/types/PublicApi';
import { type BC3Builder } from '../../../builder/BC3Builder';
import { type Diagnostic } from '../../../domain';
import { type RecordCounts } from '../../../domain/types/RecordCounts';

export type ParseMode = 'lenient' | 'strict';

export interface InternalParseOptions extends ParseOptions {
  mode?: ParseMode;
}

export interface ParseContext {
  options: InternalParseOptions;
  diagnostics: Diagnostic[];
  builder: BC3Builder;
  recordCounts: RecordCounts;
}
