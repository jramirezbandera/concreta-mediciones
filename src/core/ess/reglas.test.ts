import { describe, expect, it } from 'vitest';
import type { Chapter, Obra, Partida, PartidasMap } from '../types';
import { FICHAS_EBSS, fichaPorId, textoItem } from './catalogo';
import { estudioSsVacio } from './obra';
import { COMUNES, REGLAS_PARTIDA, fichasPropuestas, type EntradaPropuesta } from './reglas';
import {
  conEdicion,
  fichaEditada,
  fichasDelEstudio,
  fichasSinRevisar,
  marcarFicha,
  seleccionDeFichas,
} from './seleccion';
import type { EstudioSsDatos } from './tipos';

/* Obras INVENTADAS (las reales viven en `ejemplos pdf/`, fuera de git). */

let seq = 0;
function p(code: string, title: string, desc = '', sub?: string): Partida {
  seq += 1;
  return {
    id: `p${seq}`,
    sub,
    pos: String(seq),
    code,
    title,
    ud: 'm²',
    precio: 10,
    cantidad: 1,
    desc,
    med: [],
    items: [],
  };
}

const OBRA: Obra = { denominacion: 'Prueba', direccion: '', localidad: '' };

function entrada(
  caps: Array<[string, Partida[]]>,
  datos: Partial<EstudioSsDatos> = {},
  obra: Partial<Obra> = {},
): EntradaPropuesta {
  const chapters: Chapter[] = caps.map(([title], i) => ({
    id: `c${i}`,
    code: String(i + 1),
    title,
  }));
  const partidas: PartidasMap = Object.fromEntries(caps.map(([, ps], i) => [`c${i}`, ps]));
  return { chapters, partidas, obra: { ...OBRA, ...obra }, datos: estudioSsVacio(datos) };
}

const ids = (e: EntradaPropuesta) => fichasPropuestas(e).map((f) => f.id);

/** Reforma de vivienda: demoliciones interiores, tabiquería, instalaciones y acabados. */
const REFORMA = () =>
  entrada(
    [
      [
        'Demoliciones',
        [
          p('DPT020', 'Demolición de partición interior de fábrica revestida.'),
          p('DRS020', 'Demolición de pavimento cerámico.'),
        ],
      ],
      ['Particiones', [p('FBY010', 'Tabique de placas de yeso laminado.')]],
      [
        'Instalaciones',
        [
          p('IEI015', 'Red eléctrica de distribución interior.'),
          p('IFI005', 'Red interior de fontanería.'),
        ],
      ],
      [
        'Revestimientos',
        [
          p('RSG120', 'Pavimento interior de piezas de gres porcelánico.'),
          p('RIP030', 'Pintura plástica sobre paramento interior.'),
        ],
      ],
      [
        'Seguridad y salud',
        [p('YCX010', 'Protección colectiva. Andamio tubular de fachada, redes y barandillas.')],
      ],
    ],
    { tipos: ['reforma'] },
  );

/** Obra nueva de dos plantas con estructura de hormigón y cubierta inclinada. */
const NUEVA = () =>
  entrada(
    [
      [
        'Acondicionamiento del terreno',
        [
          p(
            'ADE010',
            'Excavación de zanjas y pozos.',
            'Con medios mecánicos, retirada de los materiales excavados y carga a camión.',
          ),
        ],
      ],
      ['Cimentaciones', [p('CSZ010', 'Zapata de cimentación de hormigón armado.')]],
      [
        'Estructuras',
        [
          p(
            'EHU015',
            'Forjado unidireccional con vigas y nervios «in situ».',
            'Hormigón vertido con bomba.',
          ),
        ],
      ],
      [
        'Fachadas',
        [p('FFF010', 'Fachada de una hoja, de fábrica de ladrillo cerámico para revestir.')],
      ],
      ['Cubiertas', [p('QTT200', 'Cubierta inclinada de teja cerámica.')]],
      ['Gestión de residuos', [p('GRA010', 'Transporte de residuos inertes con contenedor.')]],
    ],
    { tipos: ['nueva'] },
    { plantasSobreRasante: 2 },
  );

describe('la tabla de correspondencias', () => {
  it('toda ficha que nombran las reglas está en el catálogo', () => {
    const catalogo = new Set(FICHAS_EBSS.map((f) => f.id));
    for (const r of REGLAS_PARTIDA)
      for (const id of r.fichas) expect(catalogo.has(id), id).toBe(true);
    for (const id of COMUNES) expect(catalogo.has(id), id).toBe(true);
  });

  it('la propuesta sale en el orden del catálogo, sin repetir ficha ni motivo', () => {
    const orden = FICHAS_EBSS.map((f) => f.id);
    const props = fichasPropuestas(NUEVA());
    const pos = props.map((f) => orden.indexOf(f.id));
    expect([...pos].sort((a, b) => a - b)).toEqual(pos);
    expect(new Set(props.map((f) => f.id)).size).toBe(props.length);
    for (const f of props) expect(new Set(f.motivos).size).toBe(f.motivos.length);
  });

  it('un presupuesto vacío solo propone lo común a toda obra', () => {
    expect(ids(entrada([]))).toEqual(
      FICHAS_EBSS.map((f) => f.id).filter((id) => (COMUNES as readonly string[]).includes(id)),
    );
  });
});

describe('por partida', () => {
  it('reforma: demolición manual y picado, tabiquería, instalaciones y acabados', () => {
    const r = ids(REFORMA());
    for (const id of [
      'F1',
      'F3',
      'F15',
      'F22',
      'F23',
      'F32',
      'F35',
      'MA10',
      'M2',
      'M14',
      'TP3',
      'IP8',
    ])
      expect(r, id).toContain(id);
    // Nada de lo que la obra no tiene.
    for (const id of ['F2', 'F4', 'F8', 'F11', 'F16', 'F17', 'MA1', 'M7'])
      expect(r, id).not.toContain(id);
  });

  it('los capítulos de seguridad y salud, residuos y control no se leen', () => {
    // El andamio y las redes solo están en el capítulo de seguridad y salud.
    expect(ids(REFORMA())).not.toContain('MA8');
    const conGestion = fichasPropuestas(NUEVA()).find((f) => f.id === 'M2')!;
    expect(conGestion.partidas.map((x) => x.code)).not.toContain('GRA010');
  });

  it('obra nueva: zanjas y pozos, cimentación, forjado con sus medios, fachada y cubierta', () => {
    const r = ids(NUEVA());
    for (const id of [
      'F5',
      'F6',
      'F8',
      'F10',
      'F11',
      'F14',
      'F17',
      'M1',
      'M2',
      'M4',
      'M5',
      'M16',
      'MA6',
      'MA7',
      'MA9',
      'TP1',
      'TP2',
    ])
      expect(r, id).toContain(id);
    expect(r).not.toContain('F1');
  });

  it('una partida de demolición no propone la unidad que derriba', () => {
    const e = entrada(
      [
        [
          'Demoliciones',
          [
            p('DEH020', 'Demolición de forjado de hormigón armado.'),
            p('DFF020', 'Demolición de hoja exterior de fachada.'),
          ],
        ],
      ],
      {
        tipos: ['reforma'],
      },
    );
    const r = ids(e);
    expect(r).toContain('F1');
    expect(r).not.toContain('F11');
    expect(r).not.toContain('F14');
  });

  it('«Implantación» no es una plantación ni «punto de vaciado» una excavación', () => {
    const r = ids(
      entrada([
        [
          'Varios',
          [
            p('01.01', 'Transporte e Implantación. Partida Alzada.'),
            p('ICS015', 'Punto de vaciado.'),
          ],
        ],
      ]),
    );
    expect(r).not.toContain('F39');
    expect(r).not.toContain('F4');
  });

  it('el motivo nombra la partida', () => {
    const f5 = fichasPropuestas(NUEVA()).find((f) => f.id === 'F5')!;
    expect(f5.motivos).toEqual(['por ADE010 Excavación de zanjas y pozos.']);
    expect(f5.partidas[0]).toMatchObject({ chapterId: 'c0', code: 'ADE010' });
    const m4 = fichasPropuestas(NUEVA()).find((f) => f.id === 'M4')!;
    expect(m4.motivos.some((m) => m.startsWith('con «'))).toBe(true);
  });
});

describe('por los datos del estudio y de la obra', () => {
  it('vía pública, edificio en uso y grúa torre', () => {
    const e = REFORMA();
    e.datos = estudioSsVacio({
      tipos: ['reforma'],
      entorno: { viaPublica: true, edificioEnUso: true },
      medios: { gruaTorre: true },
    });
    const r = ids(e);
    for (const id of ['IP2', 'IP9', 'M7', 'F36', 'MA15', 'MA12']) expect(r, id).toContain(id);
  });

  it('andamio de fachada y redes con dos o más plantas; con una, no', () => {
    expect(ids(NUEVA())).toEqual(expect.arrayContaining(['MA1', 'MA8']));
    const baja = NUEVA();
    baja.obra = { ...baja.obra, plantasSobreRasante: 1 };
    expect(ids(baja)).not.toContain('MA1');
    expect(ids(baja)).not.toContain('MA8');
  });
});

describe('la selección como diferencia con la propuesta', () => {
  it('sin selección, sale justo la propuesta', () => {
    const props = fichasPropuestas(NUEVA());
    expect(fichasDelEstudio(props, undefined).map((f) => f.id)).toEqual(props.map((f) => f.id));
  });

  it('una ficha quitada sigue quitada al cambiar el presupuesto, y una nueva propuesta aparece sola', () => {
    const sel = marcarFicha(undefined, 'F17', false, true);
    expect(sel).toEqual({ quitadas: ['F17'] });
    const e = NUEVA();
    e.partidas.c4!.push(p('QAA010', 'Cubierta plana transitable.'));
    const r = fichasDelEstudio(fichasPropuestas(e), sel).map((f) => f.id);
    expect(r).not.toContain('F17');
    expect(r).toContain('F16');
  });

  it('marcar y quitar: añadidas y quitadas, sin listas vacías', () => {
    let sel = marcarFicha(undefined, 'F37', true, false);
    expect(sel).toEqual({ anadidas: ['F37'] });
    sel = marcarFicha(sel, 'F37', false, false);
    expect(sel).toEqual({});
    const props = fichasPropuestas(REFORMA());
    const enSel = seleccionDeFichas(props, { anadidas: ['F37'] });
    expect(enSel.find((f) => f.ficha.id === 'F37')).toMatchObject({
      propuesta: false,
      marcada: true,
    });
  });
});

describe('lo que el técnico edita en una ficha', () => {
  const f23 = fichaPorId('F23')!;
  const medida = textoItem(f23.medidas[0]!);

  it('quita riesgos por clave y medidas por texto, y añade al final', () => {
    const e = fichaEditada(f23, {
      riesgos: { quitados: ['electrico'], anadidos: [{ clave: 'ruido', causa: 'rozadora' }] },
      medidas: { quitados: [medida], anadidos: ['Medida propia'] },
    });
    expect(e.riesgos.some((r) => r.clave === 'electrico')).toBe(false);
    expect(e.riesgos.at(-1)).toEqual({ clave: 'ruido', causa: 'rozadora' });
    expect(e.medidas.map(textoItem)).not.toContain(medida);
    expect(e.medidas.at(-1)).toBe('Medida propia');
  });

  it('la edición va al estudio, y una vacía se borra', () => {
    const sel = conEdicion(undefined, 'F23', { riesgos: { quitados: ['electrico'] } });
    const f = fichasDelEstudio(fichasPropuestas(REFORMA()), sel).find((x) => x.id === 'F23')!;
    expect(f.riesgos.some((r) => r.clave === 'electrico')).toBe(false);
    expect(conEdicion(sel, 'F23', { medidas: {} })).toEqual({});
  });

  it('las redactadas por la app piden revisión hasta marcarlas revisadas', () => {
    const e = REFORMA();
    e.datos = estudioSsVacio({ tipos: ['reforma'], entorno: { edificioEnUso: true } });
    const props = fichasPropuestas(e);
    const sinRevisar = fichasSinRevisar(props, undefined).map((f) => f.id);
    expect(sinRevisar).toContain('IP9');
    expect(
      fichasSinRevisar(props, conEdicion(undefined, 'IP9', { revisada: true })).map((f) => f.id),
    ).not.toContain('IP9');
  });
});
