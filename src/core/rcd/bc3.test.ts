import { describe, expect, it } from 'vitest';
import { bc3ToObra } from '../bc3import';
import { encodeCp1252 } from '../bc3export';
import { leerResiduosBc3 } from './bc3';
import type { Conversion } from './tipos';

/* .bc3 SINTÉTICOS con la forma de los de CYPE (FIEBDC-3/2016) y el ejemplo del
   BEDEC de la propia especificación (FIEBDC-3/2024, «Clasificación de los
   residuos»). Ninguno sale de una obra real. */
const CYPE = [
  '~V|CYPE|FIEBDC-3/2016|prueba||ANSI|',
  '~K|\\2\\2\\3\\2\\2\\2\\2\\EUR\\|0|',
  '~X||ler\\Codigo LER\\\\m\\Masa del elemento\\kg\\v\\Volumen\\m3\\|',
  '~C|OBRA##||Obra de prueba|0||0|',
  '~D|OBRA##|C1#\\1\\1\\|',
  '~C|C1#||Demoliciones y revestimientos|0||0|',
  '~D|C1#|DPT020\\1\\10\\REC010\\1\\2\\|',
  '~C|DPT020|m2|Demolicion de particion interior de fabrica revestida|7.89||0|',
  '~R|DPT020|1\\re170102\\r\\53.846\\\\|1\\re170802\\r\\17.25\\\\|',
  '~C|re170102|kg|Ladrillos.|0||4|',
  '~X|re170102|ler\\17 01 02\\m\\1\\v\\0.0008\\|',
  '~C|re170802|kg|Yeso.|0||4|',
  '~X|re170802|ler\\17 08 02\\m\\1\\v\\0.001\\|',
  '~C|REC010|Ud|Revestimiento de escalera|100||0|',
  '~D|REC010|mt09\\1\\0.2\\mt18\\1.05\\1\\|',
  '~R|REC010|0\\mt09\\rp\\0.0036\\\\|0\\mt18\\rp\\0.0188\\\\|3\\re170201\\r\\0\\\\|',
  '~C|mt09|m3|Mortero de cemento|115||3|',
  '~X|mt09|ler\\17 01 01\\m\\1900\\v\\1.266667\\|',
  '~C|mt18|m2|Piezas de terrazo|9.9||3|',
  '~X|mt18|ler\\17 01 07\\m\\59.5\\v\\0.0476\\|',
  '~R|mt18|3\\re170201\\r\\0.042\\\\|',
  '~C|re170201|kg|Madera.|0||4|',
  '~X|re170201|ler\\17 02 01\\m\\1\\v\\0.000909\\|',
].join('\r\n');

const BEDEC = [
  '~V|ITeC|FIEBDC-3/2016|prueba||ANSI|',
  '~C|P6143|m2|Tabique de ladrillo hueco sencillo|0||0|',
  '~D|P6143|B0F\\1.02\\31.86\\|',
  '~R|P6143|0\\B0F\\rp\\0.01960784\\\\|',
  '~R|B0F|3\\ZF1\\r\\0.0069\\\\|',
  '~C|B0F|u|Ladrillo hueco sencillo|0||3|',
  '~X|B0F|m\\1.9\\v\\0.00138\\ler\\ZZ18975\\|',
  '~C|ZF1|m2|Film de polietileno de 25 micras|0||4|',
  '~X|ZF1|m\\0.02275\\v\\0.000025\\ler\\ZZ18971\\|',
  '~C|ZZ18975#||170102 (ladrillos)|||5|',
  '~C|ZZ18971#||150102 (envases de plastico)|||5|',
].join('\r\n');

const directo = (c: { conversion: Conversion }) => c.conversion as Extract<Conversion, { modo: 'directo' }>;

describe('residuos de un .bc3 (~R / ~X)', () => {
  it('demolición: r × masa del hijo de tipo 4, por unidad de la partida', () => {
    const r = leerResiduosBc3(CYPE);
    const c = r.porCodigo.get('DPT020')!;
    expect(c.map((x) => [x.ler, x.tipo])).toEqual([
      ['17 01 02', 'demolicion'],
      ['17 08 02', 'demolicion'],
    ]);
    expect(directo(c[0]!).tPorUd).toBeCloseTo(0.053846, 9);
    expect(directo(c[0]!).m3PorUd).toBeCloseTo(53.846 * 0.0008, 9);
    expect(directo(c[0]!).m3Base).toBe('aparente');
  });

  it('colocación: cantidad del material × rp × masa; más el embalaje del propio material', () => {
    const c = leerResiduosBc3(CYPE).porCodigo.get('REC010')!;
    const por = new Map(c.map((x) => [x.ler, directo(x)]));
    expect(por.get('17 01 01')!.tPorUd).toBeCloseTo((0.2 * 0.0036 * 1900) / 1000, 12);
    expect(por.get('17 01 07')!.tPorUd).toBeCloseTo((1.05 * 0.0188 * 59.5) / 1000, 12);
    expect(por.get('17 02 01')!.tPorUd).toBeCloseTo((1.05 * 0.042) / 1000, 12); // embalaje de mt18
    expect(c.find((x) => x.ler === '17 02 01')!.tipo).toBe('embalaje');
  });

  it('BEDEC: el LER llega por un concepto de clasificación (tipo 5)', () => {
    const c = leerResiduosBc3(BEDEC).porCodigo.get('P6143')!;
    const q = 1.02 * 31.86;
    expect(c.map((x) => x.ler)).toEqual(['15 01 02', '17 01 02']);
    expect(directo(c.find((x) => x.ler === '17 01 02')!).tPorUd).toBeCloseTo((q * 0.01960784 * 1.9) / 1000, 12);
    expect(directo(c.find((x) => x.ler === '15 01 02')!).tPorUd).toBeCloseTo((q * 0.0069 * 0.02275) / 1000, 12);
  });

  it('sin ~R, nada', () => {
    expect(leerResiduosBc3('~V|x|FIEBDC-3/2002|y||ANSI|\r\n~C|A|m|a|1||0|').porCodigo.size).toBe(0);
  });

  it('al importar la obra, las partidas con ~R entran como propuesta del banco', () => {
    const { data, report } = bc3ToObra(encodeCp1252(CYPE));
    const ps = Object.values(data.partidas).flat();
    const dpt = ps.find((p) => p.code === 'DPT020')!;
    expect(dpt.rcd).toMatchObject({ estado: 'propuesta', origen: { tipo: 'banco' } });
    expect(dpt.rcd!.componentes).toHaveLength(2);
    expect(report.residuos).toBe(2);
    expect(report.warnings.some((w) => /2 partidas traen sus residuos del banco/.test(w))).toBe(true);
    expect(report.warnings.some((w) => /~R/.test(w) && /no soportado/.test(w))).toBe(false);
  });
});
