import { describe, expect, it } from 'vitest';
import catalogo from './tablas/catalogo.json';

/* Catálogo de ensayos de la hoja de la Junta (V04), generado por
   scripts/pcc/extraer_junta.py con scripts/pcc/correcciones_junta.json
   (docs/plan-control-calidad.md, §3 y §3 bis). */

type Fila = (typeof catalogo.ensayos)[number] & {
  lote: { tipo: string; n: number | null; tamano?: number | null; ud?: string | null; calculo?: string };
  correcciones?: Array<{ original: object; motivo: string; cita: string }>;
  alternativaDe?: string;
};
const ensayos = catalogo.ensayos as Fila[];
const porId = new Map(ensayos.map((e) => [e.id, e]));

// Citas derogadas (K-PCC.50) y normas de ensayo sustituidas (K-PCC.51) que no pueden llegar a
// ningún texto del catálogo. Escrita aquí aparte de la del script, para que una no tape a la otra.
const VETADAS = [
  /\bEHE\b/, /EHE-0?8/, /EFHE/, /\bEAE\b/, /RC-0[38]/, /1630\/1992/, /89\/106/, /\bDITE\b/, /\bNBE\b/,
  /clases? generales/i, /MOPU/, /UNE[- ]EN 13829/, /UNE 833\d\d/, /UNE 70\d\d:19/, /UNE 670[23]\d/,
  /UNE 104281/, /art[íi]culo 37/i, /m[íi]nimo 5 ensayos por desplazamiento/i,
];

describe('catálogo de ensayos de la Junta', () => {
  it('es la V04 sin el capítulo 15 (urbanización, fuera de alcance)', () => {
    expect(catalogo.version).toBe('junta-PCC-V04-2023');
    expect(ensayos.length).toBe(540);
    expect(new Set(ensayos.map((e) => e.capitulo))).toEqual(
      new Set(['02', '03', '06', '07', '08', '09', '10', '11', '13']),
    );
    expect(porId.size).toBe(ensayos.length);
  });

  it('cada fila tiene tipo de lote, nivel y unidad de precio', () => {
    for (const e of ensayos) {
      expect(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'], e.id).toContain(e.lote.tipo);
      expect([1, 2, 3], e.id).toContain(e.nivel);
      expect(['ensayo', 'visita'], e.id).toContain(e.unidad);
      if (['A', 'B', 'C'].includes(e.lote.tipo)) {
        expect(e.lote.tamano, e.id).toBeGreaterThan(0);
        expect(e.lote.ud, e.id).toBeTruthy();
      }
      if (e.lote.tipo === 'G') expect(e.lote.calculo, e.id).toBeTruthy();
      if (e.lote.tipo !== 'I') expect(e.precio, e.id).toBeGreaterThan(0);
    }
  });

  it('las inspecciones de ½ jornada se pagan por visita', () => {
    expect(porId.get('j03-125')?.unidad).toBe('visita');
    expect(porId.get('j08-047')?.unidad).toBe('visita');
    expect(porId.get('j08-047')?.lote).toMatchObject({ tipo: 'B', tamano: 0.2, porVisita: 5 });
  });

  it('los precios de referencia de la verificación (B (b) 10, D §3.3)', () => {
    expect(porId.get('j03-008')).toMatchObject({ precio: 59.28, lote: { calculo: 'resistencia' } });
    expect(porId.get('j03-009')).toMatchObject({ precio: 17.26, lote: { calculo: 'consistencia' } });
    expect(porId.get('j03-029')).toMatchObject({ precio: 151.45, lote: { calculo: 'penetracion' } });
    expect(porId.get('j03-085')?.precio).toBe(60.66);
    expect(porId.get('j03-084')?.precio).toBe(35.09);
  });

  it('ningún texto lleva una cita vetada', () => {
    for (const e of ensayos)
      for (const t of [e.ensayo, e.norma, e.obs])
        for (const re of VETADAS) expect(t ?? '', `${e.id}: ${re}`).not.toMatch(re);
  });

  it('cada corrección guarda lo que decía la hoja, el motivo y la cita', () => {
    const corregidas = ensayos.filter((e) => e.correcciones);
    expect(corregidas.length).toBeGreaterThan(40);
    for (const e of corregidas)
      for (const c of e.correcciones!) {
        expect(Object.keys(c.original).length, e.id).toBeGreaterThan(0);
        expect(c.motivo, e.id).toBeTruthy();
        expect(c.cita, e.id).toMatch(/K-PCC|CodE|D-ejemplos/);
      }
  });

  it('armaduras y mallas las calcula la app con el Código, no con «2 / 30 t»', () => {
    for (const id of ['j03-083', 'j03-084', 'j03-085'])
      expect(porId.get(id)?.lote, id).toMatchObject({ tipo: 'G', calculo: 'armaduras' });
    for (const id of ['j03-087', 'j03-088', 'j03-089'])
      expect(porId.get(id)?.lote, id).toMatchObject({ tipo: 'G', calculo: 'mallas' });
    expect(porId.get('j03-085')?.correcciones?.[0]?.original).toMatchObject({ lote: { tipo: 'A', tamano: 30 } });
  });

  it('una norma sustituida sin la vigente verificada queda sin norma y con el motivo', () => {
    const e = porId.get('j03-110') as Fila & { normaPendiente?: string };
    expect(e.norma).toBeNull();
    expect(e.normaPendiente).toMatch(/sustituida/);
    expect(porId.get('j08-138')?.norma).toBe('UNE-EN ISO 9972:2019');
  });

  it('las alternativas apuntan a una fila del catálogo con el mismo lote', () => {
    const alt = ensayos.filter((e) => e.alternativaDe);
    expect(alt.map((e) => e.id)).toEqual(['j03-132', 'j03-140', 'j03-141']);
    for (const e of alt) expect(e.lote).toEqual(porId.get(e.alternativaDe!)?.lote);
  });
});
