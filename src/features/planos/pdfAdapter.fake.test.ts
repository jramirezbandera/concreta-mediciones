import { contratoPdfAdapter } from './pdfAdapter.contrato';
import { crearAdapterFake } from './pdfAdapter.fake';

contratoPdfAdapter('doble', () => crearAdapterFake());
