import { describe, expect, it } from 'vitest';
import { textoPlano, type BloqueDoc, type SeccionDoc } from '../documento/tipos';
import type { Chapter, Obra, Partida, PartidasMap, Rates } from '../types';
import { FICHAS_EBSS } from './catalogo';
import { estudioSs, TITULO_ESTUDIO_BASICO, type EntradaDocumentoEss } from './documento';
import { estudioSsVacio } from './obra';
import { buscarProhibidos } from './prohibidos';
import { SERVICIOS_AFECTADOS, type EstudioSsDatos } from './tipos';

/* Obra INVENTADA: reforma de vivienda de 2 plantas con demoliciones, forjado,
   cubierta inclinada e instalaciones. */

const RATES: Rates = { iva: 0.1, gg: 0.13, bi: 0.06, ci: 0, coefK: 1 };
const OBRA: Obra = {
  denominacion: 'Reforma de vivienda',
  direccion: 'Calle Mayor 1',
  localidad: 'Málaga',
  promotor: { nombre: 'Promotora de prueba' },
  plantasSobreRasante: 2,
};

let seq = 0;
function p(title: string, precio = 1000, cantidad = 10): Partida {
  seq += 1;
  return {
    id: `p${seq}`,
    pos: String(seq),
    code: `C${seq}`,
    title,
    ud: 'm²',
    precio,
    cantidad,
    desc: '',
    med: [],
    items: [],
  };
}

/** Todos los datos que pide el estudio, declarados. */
const COMPLETO: Partial<EstudioSsDatos> = {
  fecha: '2026-11-01',
  tipos: ['reforma'],
  manoDeObra: { plazoDias: 80, maxTrabajadores: 6 },
  subterraneas: false,
  amianto: { estado: 'no_identificado' },
  coordinacion: { variosProyectistas: false, variasEmpresas: true },
  entorno: {
    centroAsistencial: { nombre: 'Hospital de prueba', distancia_km: 4.2, tiempo_min: 9 },
    viaPublica: false,
    edificioEnUso: false,
    servicios: Object.fromEntries(SERVICIOS_AFECTADOS.map((s) => [s, false])),
  },
  redactor: { nombre: 'Técnica de prueba', titulacion: 'Arquitecta técnica', colegiado: '1234' },
};

function entrada(datos: Partial<EstudioSsDatos> = COMPLETO, precio = 1000): EntradaDocumentoEss {
  const caps: Array<[string, Partida[]]> = [
    [
      'Demoliciones',
      [
        p('Demolición de partición interior de fábrica revestida.', precio),
        p('Demolición de pavimento cerámico.', precio),
      ],
    ],
    ['Estructuras', [p('Forjado unidireccional de viguetas de hormigón.', precio)]],
    ['Cubiertas', [p('Cubierta inclinada de teja cerámica.', precio)]],
    [
      'Instalaciones',
      [
        p('Red eléctrica de distribución interior.', precio),
        p('Red interior de fontanería.', precio),
      ],
    ],
    ['Revestimientos', [p('Pintura plástica sobre paramento interior.', precio)]],
  ];
  const chapters: Chapter[] = caps.map(([title], i) => ({
    id: `c${i}`,
    code: String(i + 1),
    title,
  }));
  const partidas: PartidasMap = Object.fromEntries(caps.map(([, ps], i) => [`c${i}`, ps]));
  return { chapters, partidas, banco: {}, rates: RATES, obra: OBRA, datos: estudioSsVacio(datos) };
}

const seccion = (s: SeccionDoc[], id: string) => s.find((x) => x.id === id)!;
const texto = (b: BloqueDoc[]) =>
  textoPlano({ titulo: '', secciones: [{ id: 'x', titulo: '', bloques: b }] });

describe('el documento', () => {
  it('los 14 apartados y los datos generales, en orden', () => {
    const { doc } = estudioSs(entrada());
    expect(doc.titulo).toBe(TITULO_ESTUDIO_BASICO);
    expect(doc.secciones.map((s) => s.titulo.split('.')[0])).toEqual([
      'Datos generales',
      ...Array.from({ length: 14 }, (_, i) => String(i + 1)),
    ]);
    expect(doc.firma).toEqual({
      nombre: 'Técnica de prueba',
      sub: 'Arquitecta técnica · Col. 1234',
    });
  });

  it('con todos los datos, no quedan pendientes de datos', () => {
    const { pendientes, art4 } = estudioSs(entrada());
    expect(art4.resultado).toBe('basico');
    expect(pendientes).toEqual([]);
  });

  it('nada de la lista de prohibidos, ni con todas las fichas del catálogo marcadas', () => {
    const datos = {
      ...COMPLETO,
      seleccion: { anadidas: FICHAS_EBSS.map((f) => f.id) },
      medios: { gruaTorre: true, gruaMovil: true },
    };
    const plano = textoPlano(estudioSs(entrada(datos)).doc);
    expect(buscarProhibidos(plano)).toEqual([]);
    // Los ids del catálogo no se imprimen: las remisiones nombran la ficha.
    expect(plano).not.toMatch(/\((ver )?(IP|MA|TP|F|M)\d+\)/);
  });

  it('las fichas van como subapartados, cada una con su tabla de cuatro columnas', () => {
    const s8 = seccion(estudioSs(entrada()).doc.secciones, 'no-eliminables');
    const subs = s8.bloques
      .filter((b) => b.kind === 'sub')
      .map((b) => (b.kind === 'sub' ? b.texto : ''));
    expect(subs).toContain('8.1. Riesgos comunes a toda la obra');
    expect(subs).toContain('Estructura de hormigón: ferralla, forjados y hormigonado');
    const tabla = s8.bloques.find((b) => b.kind === 'tabla');
    expect(tabla?.kind === 'tabla' && tabla.t.columnas.map((c) => c.titulo)).toEqual([
      'Riesgo',
      'Medidas preventivas',
      'Protecciones colectivas',
      'EPI',
    ]);
    expect(tabla?.kind === 'tabla' && tabla.t.columnas.reduce((a, c) => a + c.ancho, 0)).toBe(
      10546,
    );
  });
});

describe('1. Justificación (art. 4)', () => {
  it('básico: PEC desglosado desde el presupuesto y compromiso del promotor', () => {
    const s1 = texto(seccion(estudioSs(entrada()).doc.secciones, 'justificacion').bloques);
    // 7 partidas × 10 m² × 1.000 € = 70.000 € de PEM; GG 13 %, BI 6 %, IVA 10 %.
    expect(s1).toContain('Presupuesto de ejecución material (PEM) | 70.000,00 €');
    expect(s1).toContain('91.630,00 €');
    expect(s1).toMatch(/estudio básico de seguridad y salud \(art\. 4\.2\)/);
    expect(s1).toContain('El promotor se compromete');
  });

  it('completo: solo la justificación y un pendiente', () => {
    const r = estudioSs(entrada(COMPLETO, 10_000));
    expect(r.art4.resultado).toBe('completo');
    expect(r.doc.secciones.map((s) => s.id)).toEqual(['justificacion']);
    expect(r.pendientes.map((x) => x.id)).toEqual(['completo']);
  });

  it('sin datos: pendiente, con lo que falta en su apartado y en la lista', () => {
    const r = estudioSs(entrada({}));
    expect(r.art4.resultado).toBe('pendiente');
    const s1 = seccion(r.doc.secciones, 'justificacion');
    expect(texto(s1.bloques)).toContain('Pendiente: Falta el plazo de ejecución');
    expect(r.pendientes.map((x) => x.id)).toEqual(
      expect.arrayContaining(['tipos', 'plazo', 'trabajadores', 'redactor']),
    );
  });
});

describe('los demás apartados', () => {
  it('6: la dotación del VII Convenio con los trabajadores a la vez', () => {
    const s6 = texto(seccion(estudioSs(entrada()).doc.secciones, 'implantacion').bloques);
    expect(s6).toContain('Lavabos | 10 trabajadores o fracción | 1');
    expect(s6).toContain('seis trabajadores a la vez');
  });

  it('10: el andamio, la cubierta y el forjado dan el apartado 1 del anexo II', () => {
    const s10 = texto(seccion(estudioSs(entrada()).doc.secciones, 'anexo-ii').bloques);
    expect(s10).toMatch(/^1\. /m);
    expect(s10).toContain('recurso preventivo');
  });

  it('11: reforma sin amianto declarado, pendiente; obra nueva, no procede', () => {
    const sinAmianto = { ...COMPLETO, amianto: undefined };
    expect(
      texto(seccion(estudioSs(entrada(sinAmianto)).doc.secciones, 'amianto').bloques),
    ).toContain('Pendiente: Falta declarar el amianto');
    const nueva = { ...COMPLETO, tipos: ['nueva' as const], amianto: undefined };
    expect(texto(seccion(estudioSs(entrada(nueva)).doc.secciones, 'amianto').bloques)).toContain(
      'no procede la identificación',
    );
  });

  it('12: los trabajos posteriores de la cubierta y las instalaciones', () => {
    const s12 = seccion(estudioSs(entrada()).doc.secciones, 'posteriores');
    const subs = s12.bloques
      .filter((b) => b.kind === 'sub')
      .map((b) => (b.kind === 'sub' ? b.texto : ''));
    expect(subs).toEqual(['12.1. Mantenimiento de cubiertas', '12.2. Instalaciones y ascensor']);
  });

  it('datos generales: promotor y autor del estudio desde la obra', () => {
    const s0 = texto(seccion(estudioSs(entrada()).doc.secciones, 'datos').bloques);
    expect(s0).toContain('Promotor | Promotora de prueba');
    expect(s0).toContain(
      'Técnica de prueba, Arquitecta técnica, técnico competente designado por el promotor',
    );
    expect(s0).toContain('Tipo de obra | Reforma');
    expect(s0).toContain('Emplazamiento | Calle Mayor 1, Málaga');
  });

  it('14: lugar y fecha', () => {
    expect(texto(seccion(estudioSs(entrada()).doc.secciones, 'firma').bloques)).toContain(
      'En Málaga, a 1 de noviembre de 2026.',
    );
  });
});
