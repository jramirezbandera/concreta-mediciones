import { describe, it, expect } from 'vitest';
import {
  ANEXO_II,
  APARTADOS_ANEXO_II,
  CATALOGO_EBSS,
  FICHAS_EBSS,
  NOMBRES_RIESGO,
  fichaPorId,
  fichasDeGrupo,
  fichasDelAnalisis,
  fichasRedactadasPorApp,
  grupoDeId,
  nombreRiesgo,
  riesgosDeFicha,
  textoCatalogo,
  textoFicha,
  textoItem,
} from './catalogo';
import { buscarProhibidos } from './prohibidos';
import { CLAVES_RIESGO, GRUPOS_FICHA, type ClaveRiesgo, type FichaCatalogo } from './tipos';

// =============================================================================
// feature-35, paso 3: el catálogo de fichas como datos.
// =============================================================================

const claves = new Set<string>(CLAVES_RIESGO);

describe('recuento y origen (analisis §4.10)', () => {
  it('89 fichas del análisis y 4 redactadas por la app', () => {
    expect(fichasDelAnalisis()).toHaveLength(89);
    expect(fichasRedactadasPorApp().map((f) => f.id)).toEqual(['IP9', 'F40', 'F41', 'F42']);
    expect(FICHAS_EBSS).toHaveLength(93);
  });

  it('por grupos: 8 IP, 40 F, 16 MA, 22 M y 3 TP del análisis', () => {
    const delAnalisis = fichasDelAnalisis();
    const cuenta = (g: string) => delAnalisis.filter((f) => f.grupo === g).length;
    expect(cuenta('IP')).toBe(8);
    expect(cuenta('F')).toBe(40);
    expect(cuenta('MA')).toBe(16);
    expect(cuenta('M')).toBe(22);
    expect(cuenta('TP')).toBe(3);
  });

  it('57 fichas del análisis llevan la marca (vivienda)', () => {
    expect(fichasDelAnalisis().filter((f) => f.vivienda)).toHaveLength(57);
  });

  it('las redactadas por la app no tienen fuentes, y las del análisis sí', () => {
    for (const f of FICHAS_EBSS) {
      if (f.redactadaPorApp) expect(f.fuentes).toEqual([]);
      else expect(f.fuentes.length).toBeGreaterThan(0);
      for (const s of f.fuentes) expect(s).toMatch(/^ss(0[1-9]|1[0-5])$/);
    }
  });

  it('el catálogo lleva su procedencia, como las tablas de la app', () => {
    expect(CATALOGO_EBSS.procedencia.fecha).toBe('2026-10-18');
    expect(CATALOGO_EBSS.procedencia.fuente).toContain('analisis-ejemplos-ebss');
    expect(NOMBRES_RIESGO.procedencia.edicion).toContain('K-SYS.15');
  });
});

describe('ids y grupos', () => {
  it('ids únicos, con el prefijo de su grupo', () => {
    const ids = FICHAS_EBSS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of FICHAS_EBSS) expect(grupoDeId(f.id)).toBe(f.grupo);
    expect(grupoDeId('X1')).toBeUndefined();
  });

  it('fichaPorId y fichasDeGrupo', () => {
    expect(fichaPorId('MA1')?.titulo).toContain('Andamio tubular');
    expect(fichaPorId('ZZ9')).toBeUndefined();
    for (const g of GRUPOS_FICHA) {
      for (const f of fichasDeGrupo(g)) expect(f.grupo).toBe(g);
    }
    expect(GRUPOS_FICHA.reduce((n, g) => n + fichasDeGrupo(g).length, 0)).toBe(FICHAS_EBSS.length);
  });
});

describe('cada ficha', () => {
  it('tiene título, descripción, eficacia, al menos un riesgo y una medida', () => {
    for (const f of FICHAS_EBSS) {
      expect(f.titulo.trim(), f.id).not.toBe('');
      expect(f.descripcion.trim(), f.id).not.toBe('');
      expect(f.eficacia.trim(), f.id).not.toBe('');
      expect(riesgosDeFicha(f).length, f.id).toBeGreaterThan(0);
      expect(f.medidas.length, f.id).toBeGreaterThan(0);
    }
  });

  it('cada riesgo tiene una clave válida, sin repetir dentro de su lista', () => {
    // Una protección colectiva puede evitar la caída y, a la vez, tener riesgo
    // de caída en su montaje: `evita` y `riesgos` se comprueban por separado.
    for (const f of FICHAS_EBSS) {
      for (const lista of [f.riesgos, f.evita ?? []]) {
        const vistas = new Set<ClaveRiesgo>();
        for (const x of lista) {
          expect(claves.has(x.clave), `${f.id}: ${x.clave}`).toBe(true);
          expect(vistas.has(x.clave), `${f.id} repite ${x.clave}`).toBe(false);
          vistas.add(x.clave);
        }
      }
    }
  });

  it('los textos no están vacíos ni repetidos dentro de su lista', () => {
    for (const f of FICHAS_EBSS) {
      for (const lista of [f.medidas, f.protecciones, f.epi]) {
        const textos = lista.map(textoItem);
        for (const t of textos) expect(t.trim(), f.id).not.toBe('');
        expect(new Set(textos).size, f.id).toBe(textos.length);
      }
    }
  });

  it('los apartados del anexo II están entre 1 y 10', () => {
    const vistos = new Set<number>();
    for (const f of FICHAS_EBSS) {
      for (const a of f.anexoII ?? []) {
        expect(APARTADOS_ANEXO_II).toContain(a.apartado);
        vistos.add(a.apartado);
      }
    }
    // Los que una obra de vivienda puede activar: 1, 2, 4, 6 y 10.
    expect([...vistos].sort((a, b) => a - b)).toEqual([1, 2, 4, 6, 10]);
    for (const n of APARTADOS_ANEXO_II) expect(ANEXO_II.datos[n]).toBeTruthy();
  });

  it('solo los trabajos posteriores llevan previsiones e informaciones', () => {
    for (const f of FICHAS_EBSS) {
      if (f.grupo === 'TP') {
        expect(f.previsiones?.length, f.id).toBeGreaterThan(0);
        expect(f.informaciones?.length, f.id).toBeGreaterThan(0);
      } else {
        expect(f.previsiones, f.id).toBeUndefined();
        expect(f.informaciones, f.id).toBeUndefined();
      }
    }
  });

  it('el amianto solo sale en la demolición, remitiendo al apartado 11', () => {
    const conAmianto = FICHAS_EBSS.filter((f) =>
      riesgosDeFicha(f).some((x) => x.clave === 'amianto'),
    );
    expect(conAmianto.map((f) => f.id)).toEqual(['F1']);
    expect(fichaPorId('F1')?.anexoII?.some((a) => a.apartado === 2)).toBe(true);
  });
});

describe('nombres de riesgo (K-SYS.15)', () => {
  it('las 28 claves tienen nombre, y los cinco ajustados son los que mandan', () => {
    for (const c of CLAVES_RIESGO) expect(nombreRiesgo(c).trim()).not.toBe('');
    expect(nombreRiesgo('electrico')).toBe('Contactos eléctricos');
    expect(nombreRiesgo('quimicos')).toBe('Exposición a agentes químicos');
    expect(nombreRiesgo('biologicos')).toBe('Exposición a agentes biológicos');
    expect(nombreRiesgo('ruido')).toBe('Exposición al ruido');
    expect(nombreRiesgo('amianto')).toBe('Exposición al amianto');
  });

  it('los nombres son únicos', () => {
    const nombres = CLAVES_RIESGO.map(nombreRiesgo);
    expect(new Set(nombres).size).toBe(nombres.length);
  });
});

describe('el bloque «toda la obra» (F0, decisión 6)', () => {
  const f0 = fichaPorId('F0') as FichaCatalogo;

  it('todas sus medidas, protecciones y EPI llevan frecuencia', () => {
    for (const lista of [f0.medidas, f0.protecciones, f0.epi]) {
      for (const item of lista) {
        expect(typeof item).toBe('object');
        if (typeof item === 'object')
          expect(['permanente', 'frecuente', 'ocasional']).toContain(item.frecuencia);
      }
    }
  });

  it('el clima es el riesgo evitable del bloque', () => {
    const evitables = f0.medidas.filter((m) => typeof m === 'object' && m.evitable);
    expect(evitables).toHaveLength(1);
    expect(textoItem(evitables[0]!)).toMatch(/viento fuerte/);
  });

  it('ninguna otra ficha lleva frecuencias', () => {
    for (const f of FICHAS_EBSS) {
      if (f.id === 'F0') continue;
      for (const item of [...f.medidas, ...f.protecciones, ...f.epi]) {
        if (typeof item === 'object') expect(item.frecuencia, f.id).toBeUndefined();
      }
    }
  });
});

describe('la lista de prohibidos', () => {
  it('no aparece en el catálogo', () => {
    for (const f of FICHAS_EBSS) {
      expect(buscarProhibidos(textoFicha(f)), f.id).toEqual([]);
    }
    expect(buscarProhibidos(textoCatalogo())).toEqual([]);
  });

  it('detecta lo que los ejemplos traían', () => {
    const motivos = (t: string) => buscarProhibidos(t).map((x) => x.coincidencia);
    expect(motivos('Se presentará el aviso previo según el anexo III.')).toEqual([
      'aviso previo',
      'anexo III',
    ]);
    expect(motivos('Un retrete por cada 25 trabajadores, según el RD 1627/1997')).toHaveLength(1);
    expect(motivos('Toma de tierra de 20 Ω como máximo')).toHaveLength(1);
    expect(motivos('Diferenciales de 300 mA en fuerza y 30 mA en alumbrado')).toHaveLength(1);
    expect(motivos('Cargas de 25 kg como máximo, según el RD 487/1997')).toHaveLength(1);
    expect(motivos('Botiquín según la Orden TAS/2947/2007')).toHaveLength(1);
    expect(motivos('Cinturón de seguridad clase A')).toHaveLength(1);
    expect(motivos('Distancias de 3, 5 y 6 m según la tensión; corte en 50 kV')).toHaveLength(2);
    expect(motivos('Lugares de trabajo según el RD 486/1997')).toHaveLength(1);
    expect(
      motivos('Un retrete por cada 25 trabajadores, según el VII Convenio, art. 232.2'),
    ).toEqual([]);
    expect(motivos('Anexo II, apartado 1')).toEqual([]);
  });
});

describe('cifras en conflicto (analisis §4.9, K-SYS.16): sin número', () => {
  const todo = textoCatalogo();
  const porFicha = FICHAS_EBSS.map((f) => [f.id, textoFicha(f)] as const);

  it('iluminación en lux, resistencia en ohmios, 300 mA, 150 kg/m y 600 kg/m²', () => {
    expect(todo).not.toMatch(/\blux\b/i);
    expect(todo).not.toMatch(/Ω|ohmio/);
    expect(todo).not.toMatch(/300 mA/);
    expect(todo).not.toMatch(/150 kg\/m/);
    expect(todo).not.toMatch(/600 kg/);
  });

  it('entibación, acopios y vehículos al borde, sin profundidad ni distancia', () => {
    expect(todo).not.toMatch(/entib[^.\n]{0,60}\b\d+(,\d+)? m\b/i);
    expect(todo).not.toMatch(/acopios?[^.\n]{0,40}\b\d+(,\d+)? m\b[^.\n]{0,20}borde/i);
    expect(todo).not.toMatch(
      /borde[^.\n]{0,40}\b(2|3|4|2,50)\s?m\b[^.\n]{0,30}(acopio|veh[ií]culo|ligero|pesado)/i,
    );
  });

  it('rodapié, pies derechos, borriquetas, compresor, andamio y bajante, sin cifra', () => {
    expect(todo).not.toMatch(/rodapi[eé] de (15|20) cm/i);
    expect(todo).not.toMatch(/pies derechos[^.\n]{0,60}2,30 m/i);
    expect(todo).not.toMatch(/borriquet[^.\n]{0,80}\b(2,5|3,5|6) m\b/i);
    expect(todo).not.toMatch(/compresor[^.\n]{0,80}\b(8|10|15) m\b/i);
    expect(todo).not.toMatch(/\b4 m\b[^.\n]{0,40}auditiv/i);
    expect(todo).not.toMatch(/\b(20|30) cm\b[^.\n]{0,40}fachada/i);
    expect(todo).not.toMatch(/fachada[^.\n]{0,40}\b(20|30) cm\b/i);
    expect(todo).not.toMatch(/contenedor[^.\n]{0,40}\b[12] m\b/i);
  });

  it('el viento solo tiene cifra en la grúa torre (RD 836/2003)', () => {
    for (const [id, t] of porFicha) {
      const vientos = t.match(/\d+ km\/h/g) ?? [];
      if (id === 'M7') expect(vientos.sort()).toEqual(['50 km/h', '70 km/h', '72 km/h']);
      else if (id === 'M1')
        expect(vientos).toEqual(['20 km/h']); // velocidad de la máquina, no viento
      else expect(vientos, id).toEqual([]);
    }
  });

  it('las cifras verificadas sí están: barandilla, escalera, ruido, líneas, diferencial', () => {
    expect(todo).toMatch(/90 cm como mínimo/);
    expect(todo).toMatch(/caída de más de 2 m/);
    expect(todo).toMatch(/sobrepasa al menos 1 m/i);
    expect(todo).toMatch(/75°/);
    expect(todo).toMatch(/3,5 m/);
    expect(todo).toMatch(/85 dB\(A\)/);
    expect(todo).toMatch(/3 m hasta 66 kV, 5 m de 110 a 220 kV y 7 m a 380 kV/);
    expect(todo).toMatch(/30 mA como máximo/);
    expect(todo).toMatch(/RA × Ia ≤ 24 V/);
    expect(todo).toMatch(/IP45/);
    expect(todo).toMatch(/450\/750 V/);
    expect(todo).toMatch(/72 km\/h/);
  });

  it('los 25 kg van como buena práctica, sin el RD 487/1997', () => {
    expect(todo).toMatch(/25 kg/);
    expect(todo).not.toMatch(/487\/1997/);
  });
});

describe('remisiones entre fichas', () => {
  it('toda «ver XX» apunta a una ficha que existe', () => {
    for (const f of FICHAS_EBSS) {
      const t = textoFicha(f);
      for (const m of t.matchAll(/\(ver ([^)]+)\)/g)) {
        for (const id of m[1]!
          .split(/,| y /)
          .map((s) => s.trim())
          .filter(Boolean)) {
          expect(fichaPorId(id), `${f.id} remite a ${id}`).toBeDefined();
        }
      }
    }
  });
});

// feature-35, paso 5: lo que el documento imprime de cada ficha.
describe('lo que se imprime y lo que no (paso 5)', () => {
  const items = (f: FichaCatalogo) => [...f.medidas, ...f.protecciones, ...f.epi];

  it('las medidas evitables nombran un riesgo válido y no llevan frecuencia salvo en F0', () => {
    const evitables = FICHAS_EBSS.flatMap((f) =>
      items(f).flatMap((i) => (typeof i === 'object' && i.evitable ? [[f.id, i] as const] : [])),
    );
    expect(evitables.map(([id]) => id).sort()).toEqual(['F0', 'F1', 'F22', 'F3', 'F35', 'IP3']);
    for (const [id, i] of evitables) {
      expect(claves.has(i.evitable!), id).toBe(true);
      if (id !== 'F0') expect(i.frecuencia, id).toBeUndefined();
    }
  });

  it('las notas que se imprimen no hablan al proyectista ni citan el análisis', () => {
    for (const f of FICHAS_EBSS) {
      for (const n of f.notas ?? [])
        expect(n, f.id).not.toMatch(
          /proyectista|redactada por la app|K-SYS|decisión|análisis|ss\d\d/,
        );
    }
  });

  it('las redactadas por la app avisan al proyectista en `avisos`', () => {
    for (const f of fichasRedactadasPorApp())
      expect(
        f.avisos?.some((a) => /redactada por la app/.test(a)),
        f.id,
      ).toBe(true);
  });
});
