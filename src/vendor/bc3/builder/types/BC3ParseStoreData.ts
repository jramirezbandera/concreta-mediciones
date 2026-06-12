import { type Diagnostic } from '../../domain/types/Diagnostic';
import { type RecordCounts } from '../../domain/types/RecordCounts';
import { type ImporterSource } from '../../importers';
import {
  type AInput,
  type ConceptInput,
  type DecompositionLineInput,
  type EInput,
  type GInput,
  type KDecimalsInput,
  type LInput,
  type MeasurementInput,
  type OInput,
  type VersionPropertyInput,
  type XInput,
} from '../../parsing/dispatch/parsers/types/Parsers';
import { type ParseNode } from '../store/ParseNode';

export interface BC3ParseStoreData {
  source: ImporterSource | null;
  raw: string | null;
  diagnostics: Diagnostic[] | null;

  meta?: VersionPropertyInput;
  decimals?: KDecimalsInput;

  concepts: Map<string, ConceptInput>;
  decompositions: Map<string, DecompositionLineInput[]>;
  texts: Map<string, string>;
  measurements: MeasurementInput[];

  // Phase 5: Extended records
  pliegos: Map<string, LInput>;
  pliegosDictionary?: LInput;
  itCodes: Map<string, XInput>;
  itCodesDictionary?: XInput;
  entities: Map<string, EInput>;
  thesaurus: Map<string, AInput>;
  costOverrides: Map<string, OInput>;
  attachments?: GInput[];

  nodes?: Map<string, ParseNode>;
  roots?: string[];

  recordCounts?: RecordCounts;
}
