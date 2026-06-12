import { type ImporterResult } from './ImporterResult';

export abstract class Importer<TInput> {
  abstract load(source: TInput): Promise<ImporterResult>;
}
