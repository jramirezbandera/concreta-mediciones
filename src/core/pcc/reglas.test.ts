import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bc3ToObra } from '../bc3import';
import { DEMO_REF_SOURCES } from '../refdata';
import catalogo from './tablas/catalogo.json';
import familiasJson from './tablas/familias.json';
import {
  desdeDescomposicion,
  diametrosDe,
  estadoTrasConfirmar,
  filaDe,
  huellaDe,
  necesitaRevision,
  proponerControl,
} from './reglas';

/* Reglas que proponen la familia de control de una partida (docs/plan-control-calidad.md §4).
   En la CI, un juego de códigos y títulos de la BCCA 2023 y de Precio Centro 2017 escrito a
   mano; en local, el recorrido de las bases enteras (no viajan en git). */

const p = (code: string, title: string, ud: string, desc = '') => ({ code, title, ud, desc });
const fam = (r: ReturnType<typeof proponerControl>) => (r ? (r.familia ?? `sin:${r.origen.ref}`) : null);

describe('familias por código y título (BCCA 2023)', () => {
  const casos: Array<[string, string, string, string]> = [
    ['03HAZ00010', 'HORMIGÓN HA-25/P/40/XC2 EN ZAPATAS Y ENCEPADOS', 'm3', 'hormigon-estructural'],
    ['05HHP00010', 'HORMIGÓN PARA ARMAR HA-25/P/20/XC2 EN PILARES', 'm3', 'hormigon-estructural'],
    ['05FUA00010', 'FORJADO VIG. AUTORR. ARM. PRETEN. BOV. CER. (HA-25)', 'm2', 'forjado-viguetas'],
    ['03ACC00010', 'ACERO EN BARRAS CORRUGADAS B400S EN CIMENT.', 'kg', 'acero-armar'],
    ['05HAM00010', 'ACERO ME B500S EN MALLAS ELECTROSOLDADAS', 'kg', 'mallas'],
    ['03CTI00010', 'MICROPILOTE "IN SITU" C/CAMISA ACERO DIÁM. 48 mm', 'm', 'micropilotes'],
    ['03CPS00010', 'PILOTE "IN SITU" ENT. REC/AZUCHE HA-25/F/20/XC2 DIÁM. 45 cm', 'm', 'pilotes'],
    ['03CPP00010', 'PILOTE PREFABRIC. PROF. HASTA 12 m DIÁM. 35 cm', 'm', 'pilotes'],
    ['03CMM00010', 'MURO PANTALLA 45 cm ESP. CUCH. MEC. Y 6 m PROF. (HA-25)', 'm2', 'pantallas'],
    ['05ACJ00010', 'ACERO PERFILES LAM. EN CAL. EN VIGAS UNIÓN ATORNILLADA', 'kg', 'acero-laminado'],
    ['05MLV00010', 'MADERA LAMINADA GL-24 VIGAS DIRECTRIZ RECTA HASTA 12 m', 'm3', 'madera-estructural'],
    ['06LPP00010', 'CITARA L/PERF. TALADRO PEQUEÑO', 'm2', 'fabrica-ladrillo'],
    ['06DTT00010', 'TABICÓN DE LADRILLO H/D 9 cm', 'm2', 'fabrica-ladrillo'],
    ['06BHH00010', 'FÁBRICA LIGERA 19 cm ESP. BLOQUES ARCILLA ALIGERADA', 'm2', 'fabrica-bloque'],
    ['06DPP00010', 'TABIQUE SIMPLE PL. YESO LAMINADO C/ALMA CEL. 10+30+10 (50 mm)', 'm2', 'placa-yeso'],
    ['07HNF00010', 'FALDÓN AZ. NO TRANSITABLE SOBRE TABIQUILLOS', 'm2', 'cubierta-plana'],
    ['07ITT00010', 'ENC. FALDÓN TEJAS PLANAS O CURVAS Y PARAM. LATERAL CHAPA CINC', 'm', 'cubierta-inclinada'],
    ['09ISS00010', 'IMPERMEAB. SUELOS, B. VAPOR EMULSIÓN ASFÁLTICA', 'm2', 'impermeabilizacion'],
    ['09TPP00010', 'AISLAMIENTO PAREDES PLANCHAS RIGIDAS POLIEST. 20 mm', 'm2', 'aislamiento'],
    ['10CEE00010', 'ENFOSCADO SIN MAESTREAR Y FRATASADO EN PAREDES', 'm2', 'revestimiento-continuo'],
    ['10AAA00010', 'ALICATADO AZULEJO COLOR LISO 15x15 cm FAB. ARTESANA M. BASTARDO', 'm2', 'alicatado-aplacado'],
    ['10SCC00010', 'RODAPIÉ BALDOSAS CERÁMICAS 10x20 cm MORTERO', 'm', 'solado'],
    ['10TFF00010', 'TECHO DE PLACAS ACÚSTICAS DE CONGLOM. DE LANA MINERAL', 'm2', 'falso-techo'],
    ['11LVV00010', 'VENTANA ABATIBLE ALUM. TIPO I (<=0,50 m2)', 'm2', 'carpinteria-exterior'],
    ['11SBB00010', 'BARANDILLA AC. CAL. BAST. SENC. PLET. ENTREP. CUADRAD. 14 mm', 'm', 'barandillas'],
    ['12ACC00010', 'ACRIST. TÉRMICO Y ACÚSTICO DOS LUNAS PULIDAS INCOLORAS 6mmBE/16mm', 'm2', 'vidrios'],
    ['13IPP00010', 'PINTURA PLÁSTICA LISA SOBRE LADRILLO, YESO O CEMENTO', 'm2', 'pintura'],
    ['04ECC00010', 'COLECTOR ENTERR. HORM. DIÁM. 150 mm CON RECALCE, EN TIERRAS', 'm', 'saneamiento'],
    ['08FCC00010', 'CANALIZACIÓN COBRE, SIN CALORIFUGAR, EMPOTRADA DE 12 mm', 'm', 'fontaneria'],
    ['08MBB00010', 'GRUPO PRESIÓN 8000 l/h 40 m.c.a. 1 BOMBA ASP. DEPÓSITO', 'u', 'fontaneria'],
    ['08ECC00010', 'CIRCUITO DE ALUMBRADO 3x1,5 mm2', 'm', 'electricidad'],
    ['08NOO00010', 'CAPTADOR SOLAR PLANO MONTAJE HORIZONTAL SUP. ABSORBEDORA 1,80 m', 'u', 'solar-termica'],
    ['08CCC00010', 'DEPÓSITO ACUMULADOR PARA AGUA CALIENTE SANITARIA 100 l', 'u', 'climatizacion'],
    ['08KTT00010', 'PLACA EXTERIOR PORTERO ELECTRÓNICO, UN PULSADOR', 'u', 'telecomunicaciones'],
    ['08LNN00010', 'ACOMETIDA DE GAS NATURAL', 'u', 'gas'],
    ['08MAA00010', 'ASCEN. SIN S. MÁQ. 535 kg 7 PER. 0,6 m/s 3 PAR. 7 m REC. DISCAP.', 'u', 'ascensor'],
    ['02RRR00010', 'RELLENO CON TIERRAS REALIZADO CON MEDIOS MANUALES', 'm3', 'relleno'],
    ['02ZBB00010', 'EXC. ZANJAS, TIERRA C. DURA, M. MANUALES, PROF. MÁX. 1,50 m', 'm3', 'excavacion'],
  ];
  for (const [code, title, ud, esperada] of casos)
    it(`${code} → ${esperada}`, () => expect(fam(proponerControl(p(code, title, ud)))).toBe(esperada));
});

describe('familias por código y título (Precio Centro 2017)', () => {
  const casos: Array<[string, string, string, string]> = [
    ['E04CM040', 'HORMIGÓN PARA ARMAR EN CIMENTACIÓN HA-25/P/40/IIa VERTIDO BOMBA', 'm3', 'hormigon-estructural'],
    ['E05HSA010', 'HORMIGÓN ARMADO HA-25/P/20/I PILAR ENCOFRADO METÁLICO 30x30 cm', 'm3', 'hormigon-estructural'],
    ['E05HFA010', 'FORJADO VIGUETA AUTORRESISTENTE 25+5 cm B-70 cm BOVEDILLA CERÁMICA', 'm2', 'forjado-viguetas'],
    ['E04AB020', 'ACERO CORRUGADO B 500 S', 'kg', 'acero-armar'],
    ['E04AM060', 'MALLA ELECTROSOLDADA #100x100 mm D=5 mm', 'm2', 'mallas'],
    ['E04PM010', 'MICROPILOTE TUBO ACERO D=48 mm', 'm', 'micropilotes'],
    ['E05AC010', 'ACERO LAMINADO S275 JR CERCHAS', 'kg', 'acero-laminado'],
    ['E07LP010', 'FÁBRICA LADRILLO HORMIGÓN MACIZO 5 cm 1/2 PIE MORTERO BLANCO', 'm2', 'fabrica-ladrillo'],
    ['E09AA010', 'CUBIERTA PLANA INVERTIDA TRANSITABLE BICAPA + LOSA FILTRANTE XPS', 'm2', 'cubierta-plana'],
    ['E11EB010', 'SOLADO BALDOSA BARRO 27x27 cm C/JUNTA RODAPIÉ', 'm2', 'solado'],
    ['E20TC010', 'TUBERÍA ACERO GALVANIZADO DN15 mm 1/2"', 'm', 'fontaneria'],
    ['E26BI010', 'B.I.E. 45 mm - 15 m ABATIBLE ARMARIO CON PUERTA', 'u', 'pci'],
  ];
  for (const [code, title, ud, esperada] of casos)
    it(`${code} → ${esperada}`, () => expect(fam(proponerControl(p(code, title, ud)))).toBe(esperada));
});

describe('sin control (K-PCC.70)', () => {
  it('residuos, seguridad y salud, demoliciones, control y auxiliares', () => {
    expect(fam(proponerControl(p('17HAA00010', 'TRANSPORTE DE RESIDUOS DE HORMIGÓN A PLANTA', 'm3')))).toBe('sin:residuos');
    expect(fam(proponerControl(p('19SII00010', 'PROTECTOR AUDITIVO CASQUETES ALMOHADILLAS REEMPLAZ.', 'u')))).toBe('sin:seguridad');
    expect(fam(proponerControl(p('E28PB010', 'BARANDILLA PROTECCIÓN TIPO SARGENTO', 'm')))).toBe('sin:seguridad');
    expect(fam(proponerControl(p('01CAA00010', 'DEMOLICIÓN CON MEDIOS MANUALES DE HORMIGÓN ARMADO', 'm3')))).toBe('sin:demolicion');
    expect(fam(proponerControl(p('18HHL00010', 'Resistencia a compresión', 'u')))).toBe('sin:control');
    expect(fam(proponerControl(p('06WWW00010', 'AYUDAS DE ALBAÑILERÍA EN EDIFICIO DE VIVIENDAS', 'm2')))).toBe('sin:auxiliares');
  });

  it('el hormigón de limpieza y el HM sin función estructural no tienen control', () => {
    expect(fam(proponerControl(p('E04N0010', 'HORMIGÓN EN MASA EN LIMPIEZA Y NIVELACIÓN HM-20/B/40/IIa', 'm3')))).toBe('sin:limpieza');
    expect(fam(proponerControl(p('X1', 'Solera de hormigón HM-20/B/20/X0 de 15 cm', 'm2')))).toBe('sin:hm-no-estructural');
    // un HM de cimientos sí es estructural
    expect(fam(proponerControl(p('03HMM00010', 'HORMIGÓN EN MASA HM-20/P/40/X0 EN CIMIENTOS', 'm3')))).toBe('hormigon-estructural');
  });

  it('«medios auxiliares» en la descripción no excluye la partida', () => {
    const r = proponerControl(p('X2', 'Zapata HA-25/B/20/XC2', 'm3', 'Incluso p/p de medios auxiliares y mano de obra.'));
    expect(fam(r)).toBe('hormigon-estructural');
  });

  it('el capítulo de control enlazado', () => {
    expect(proponerControl(p('18HHL00010', 'Resistencia a compresión', 'u'), { enCapituloControl: true })?.estado).toBe('capituloControl');
  });

  it('una partida que no casa con nada no se propone', () => {
    expect(proponerControl(p('X3', 'Partida alzada de imprevistos', 'pa'))).toBeNull();
    expect(estadoTrasConfirmar(proponerControl(p('19SII00010', 'PROTECTOR AUDITIVO', 'u'))!)).toBe('sinControl');
  });
});

describe('hormigón', () => {
  it('lee la designación y el tipo de elemento', () => {
    const r = proponerControl(p('03HAZ00010', 'HORMIGÓN HA-25/P/40/XC2 EN ZAPATAS Y ENCEPADOS', 'm3'))!;
    expect(r.hormigon).toMatchObject({ fila: 'cim_superficial', designacion: { texto: 'HA-25/P/40/XC2' } });
    expect(r.estado).toBe('propuesta');
    expect(r.origen.motivo).toBe('HA-25/P/40/XC2 · cimentación');
    expect(estadoTrasConfirmar(r)).toBe('confirmada');
  });

  it('fila por el texto: cimentación, pilares y muros, flexión', () => {
    expect(filaDe('hormigon ha-25 en vigas/zunchos de cimentacion')).toBe('cim_superficial');
    expect(filaDe('losa de cimentacion')).toBe('cim_superficial');
    expect(filaDe('hormigon en muros de contencion')).toBe('pilares_muros');
    expect(filaDe('pilar de 30x30')).toBe('pilares_muros');
    expect(filaDe('forjado reticular')).toBe('flexion');
    expect(filaDe('vigas planas')).toBe('flexion');
    expect(filaDe('hormigon armado')).toBeUndefined();
  });

  it('la designación de la descripción cuenta si el título no la trae', () => {
    const r = proponerControl(p('CSZ010', 'Zapata de cimentación de hormigón armado', 'm3', 'Hormigón HA-25/B/20/XC2 fabricado en central.'))!;
    expect(r.hormigon?.designacion.texto).toBe('HA-25/B/20/XC2');
  });

  it('sin designación legible se propone igual, sin datos de hormigón, para no perderla (Q2)', () => {
    for (const [code, title] of [
      ['03HAZ00099', 'Hormigón HX-2O/B/20/XC2 en zapatas de cimentación'],
      ['X1', 'Hormigón para armar en pilares'],
    ] as const) {
      const c = proponerControl(p(code, title, 'm3'))!;
      expect(c).toMatchObject({ estado: 'propuesta', familia: 'hormigon-estructural' });
      expect(c.hormigon).toBeUndefined();
      expect(c.origen.motivo).toMatch(/sin designación legible/);
    }
    // lo que no es hormigón de la estructura, no
    expect(fam(proponerControl(p('X2', 'Encofrado de zapatas de hormigón', 'm2')))).not.toBe('hormigon-estructural');
    expect(fam(proponerControl(p('X3', 'Hormigón de limpieza en zapatas', 'm3')))).not.toBe('hormigon-estructural');
    expect(fam(proponerControl(p('X4', 'Hormigón en arqueta de registro', 'ud')))).not.toBe('hormigon-estructural');
  });

  it('una clase EHE en la designación no impide proponer (el aviso lo da el cálculo)', () => {
    const r = proponerControl(p('E04CM040', 'HORMIGÓN PARA ARMAR EN CIMENTACIÓN HA-25/P/40/IIa VERTIDO BOMBA', 'm3'))!;
    expect(r.hormigon?.designacion).toMatchObject({ clases: [], clasesNoValidas: ['IIa'] });
  });

  it('la zapata compuesta de refdata propone 1,05 m³ y 40 kg desde la descomposición (O3)', () => {
    const zapata = DEMO_REF_SOURCES.flatMap((s) => Object.values(s.partidas).flat()).find((x) => x.code === 'CSZ010')!;
    expect(desdeDescomposicion(zapata.items)).toEqual({ m3PorUd: 1.05, kgPorUd: 40 });
    // medida en m³ no pide m³ por unidad, pero sí trae el acero de la cuantía
    const r = proponerControl({ ...zapata, desc: zapata.desc ?? '' })!;
    expect(r.hormigon?.m3PorUd).toBeUndefined();
    expect(r.acero).toEqual({ tipo: 'barras', kgPorUd: 40 });
  });

  it('un forjado en m² toma los m³ por m² de la descomposición', () => {
    const items = [
      { code: 'mo1', type: 'MO' as const, cantidad: 0.4, desc: 'Oficial', ud: 'h' },
      { code: 'mt1', type: 'MAT' as const, cantidad: 0.105, desc: 'Hormigón HA-25/B/20/XC1 central', ud: 'm³' },
    ];
    const r = proponerControl({ ...p('X4', 'Forjado unidireccional HA-25/B/20/XC1 canto 25+5', 'm2'), items })!;
    expect(r).toMatchObject({ familia: 'forjado-viguetas', hormigon: { fila: 'flexion', m3PorUd: 0.105 }, origen: { tipo: 'descomposicion' } });
    // sin descomposición, el dato queda pedido (null)
    expect(proponerControl(p('X5', 'Forjado reticular HA-25/B/20/XC1', 'm2'))!.hormigon?.m3PorUd).toBeNull();
  });
});

describe('acero', () => {
  it('diámetros del texto', () => {
    expect(diametrosDe('acero b 500 s ø8, ø10, ø12 y ø16')).toEqual([8, 10, 12, 16]);
    expect(diametrosDe('malla electrosoldada #100x100 mm d=5 mm')).toEqual([5]);
    expect(diametrosDe('barras de diametros 10 y 12 mm')).toEqual([10, 12]);
    expect(diametrosDe('acero corrugado')).toEqual([]);
  });

  it('barras, ferralla y mallas', () => {
    expect(proponerControl(p('X6', 'Ferralla elaborada en taller B 500 S, Ø8 a Ø16', 'kg'))!.acero).toEqual({ tipo: 'ferralla', diametros: [8, 16] });
    expect(proponerControl(p('E04AB020', 'ACERO CORRUGADO B 500 S', 'kg'))!.acero).toEqual({ tipo: 'barras' });
    expect(proponerControl(p('E04AM060', 'MALLA ELECTROSOLDADA #100x100 mm D=5 mm', 'm2'))!.acero).toEqual({ tipo: 'mallas', diametros: [5] });
  });
});

describe('huella (O6)', () => {
  it('cambiar el título tras confirmar pide revisarla', () => {
    const partida = p('X7', 'Forjado HA-25/B/20/XC1', 'm3');
    const c = { ...proponerControl(partida)!, estado: 'confirmada' as const, huella: huellaDe(partida) };
    expect(necesitaRevision(c, partida)).toBe(false);
    expect(necesitaRevision(c, { ...partida, title: 'Forjado HA-30/B/20/XC1' })).toBe(true);
    expect(necesitaRevision(c, { ...partida, ud: 'm2' })).toBe(true);
    expect(necesitaRevision({ ...c, huella: undefined }, { ...partida, title: 'otro' })).toBe(false);
  });
});

describe('familias.json', () => {
  const ids = new Set(catalogo.ensayos.map((e) => e.id));
  const codigos = new Set(catalogo.ensayos.flatMap((e) => e.apartado.split(' · ').map((x) => x.split(' ')[0]!)));
  const fams = familiasJson.familias as Array<{
    id: string;
    ensayos: string[];
    ensayosPorTexto?: Array<{ texto: string; apartados: string[] }>;
    pruebas?: Array<{ id: string; ensayos: string[]; cita: string; oblig: string; quien: string }>;
    recepcion: Array<{ texto: string; cita: string }>;
    reconocer: { codigo?: string; texto?: string };
  }>;

  it('cada apartado y cada ensayo citados existen en el catálogo', () => {
    for (const f of fams) {
      for (const a of [...f.ensayos, ...(f.ensayosPorTexto ?? []).flatMap((x) => x.apartados)])
        expect([...codigos].some((c) => c === a || c.startsWith(`${a}.`)), `${f.id}: ${a}`).toBe(true);
      for (const pr of f.pruebas ?? []) for (const e of pr.ensayos) expect(ids.has(e), `${f.id}/${pr.id}: ${e}`).toBe(true);
    }
  });

  it('cada familia tiene cita en su recepción y en sus pruebas, y regex que compilan', () => {
    expect(new Set(fams.map((f) => f.id)).size).toBe(fams.length);
    for (const f of fams) {
      for (const r of f.recepcion) expect(r.cita, f.id).toBeTruthy();
      for (const pr of f.pruebas ?? []) {
        expect(pr.cita, `${f.id}/${pr.id}`).toBeTruthy();
        expect(['R', 'P', 'C'], pr.id).toContain(pr.oblig);
        expect(['LAB', 'INST', 'OC'], pr.id).toContain(pr.quien);
      }
      for (const re of [f.reconocer.codigo, f.reconocer.texto, ...(f.ensayosPorTexto ?? []).map((x) => x.texto)])
        if (re) expect(() => new RegExp(re), `${f.id}: ${re}`).not.toThrow();
    }
  });
});

const MUESTRAS = ['BCCA2023_V02.bc3', 'centro2017_clasica.bc3'].map((n) => resolve(process.cwd(), 'docs', 'spike', 'samples', n));

describe('bases enteras (solo en local)', () => {
  for (const ruta of MUESTRAS)
    it.skipIf(!existsSync(ruta))(`${ruta.split(/[\\/]/).at(-1)}: ningún ensayo del capítulo de control se propone como obra`, () => {
      const { data } = bc3ToObra(new Uint8Array(readFileSync(ruta)));
      const control = Object.values(data.partidas)
        .flat()
        .filter((x) => /^(18[A-Za-z]|E29)/.test(x.code));
      expect(control.length).toBeGreaterThan(20);
      const conFamilia = control.filter((x) => proponerControl(x)?.familia).map((x) => `${x.code} ${x.title}`);
      expect(conFamilia).toEqual([]);
    }, 120_000);
});
