/* P1 del plan de control: el motor de calidad y sus tablas grandes no entran en el
   chunk principal. Lo comprueba sobre el `dist/` de `vite build` (se salta si no
   hay build): el chunk de entrada no contiene el catálogo de la Junta, el enlace
   con la BCCA ni la tabla de lotes del Código Estructural. */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import catalogo from './tablas/catalogo.json';
import enlace from './tablas/enlace-bcca.json';
import lotes from './tablas/lotes-hormigon.json';

const DIST = join(process.cwd(), 'dist');
const html = join(DIST, 'index.html');

describe.skipIf(!existsSync(html))('chunk principal sin las tablas de calidad (P1)', () => {
  it('ni el catálogo, ni el enlace, ni los lotes de hormigón', () => {
    const entrada = /<script[^>]+src="[^"]*?(assets\/index-[^"]+\.js)"/.exec(readFileSync(html, 'utf8'))?.[1];
    expect(entrada).toBeDefined();
    const js = readFileSync(join(DIST, entrada!), 'utf8');
    expect(js).not.toContain(catalogo.version);
    expect(js).not.toContain(catalogo.ensayos[0]!.id);
    expect(js).not.toContain(enlace.version);
    expect(js).not.toContain(lotes.id);
  });
});
