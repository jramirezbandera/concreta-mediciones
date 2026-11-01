import { describe, it, expect } from 'vitest';
import {
  ANDAMIO_PLAN_RD1215,
  BARANDILLA_RD1627,
  DISTANCIAS_RD614,
  ESCALERA_RD1215,
  RUIDO_RD286,
  TIERRA_PROVISIONAL,
  VIBRACIONES_RD1311,
  VIENTO_GRUA_TORRE,
  distanciasLineas,
  resistenciaTierraMax,
} from './cifras';

// =============================================================================
// feature-35, paso 3: las cifras verificadas de K-SYS.16.
// =============================================================================

describe('tabla 1 del RD 614/2001', () => {
  it('tiene las 13 filas cotejadas en imagen, en orden creciente', () => {
    const filas = DISTANCIAS_RD614.datos;
    expect(filas).toHaveLength(13);
    for (let i = 1; i < filas.length; i++)
      expect(filas[i]!.un_kV).toBeGreaterThan(filas[i - 1]!.un_kV);
    expect(filas[0]).toEqual({
      un_kV: 1,
      dpel1_cm: 50,
      dpel2_cm: 50,
      dprox1_cm: 70,
      dprox2_cm: 300,
    });
    expect(filas[12]).toEqual({
      un_kV: 380,
      dpel1_cm: 390,
      dpel2_cm: 250,
      dprox1_cm: 540,
      dprox2_cm: 700,
    });
    expect(DISTANCIAS_RD614.procedencia.tabla).toBe('Tabla 1');
  });

  it('baja tensión: la primera fila', () => {
    expect(distanciasLineas(0.4)).toEqual({
      dpel1_cm: 50,
      dpel2_cm: 50,
      dprox1_cm: 70,
      dprox2_cm: 300,
    });
    expect(distanciasLineas(1)).toEqual({
      dpel1_cm: 50,
      dpel2_cm: 50,
      dprox1_cm: 70,
      dprox2_cm: 300,
    });
  });

  it('tensiones de la tabla: la fila exacta', () => {
    expect(distanciasLineas(20)).toEqual({
      dpel1_cm: 72,
      dpel2_cm: 60,
      dprox1_cm: 122,
      dprox2_cm: 300,
    });
    expect(distanciasLineas(66)?.dprox2_cm).toBe(300);
    expect(distanciasLineas(110)?.dprox2_cm).toBe(500);
    expect(distanciasLineas(380)?.dprox2_cm).toBe(700);
  });

  it('tensiones intermedias: interpolación lineal, hacia arriba al cm', () => {
    // Entre 66 y 110 kV, a mitad: DPEL-1 140, DPEL-2 93 (92,5 ↑), DPROX-1 190, DPROX-2 400.
    expect(distanciasLineas(88)).toEqual({
      dpel1_cm: 140,
      dpel2_cm: 93,
      dprox1_cm: 190,
      dprox2_cm: 400,
    });
    // Entre 1 y 3 kV (una línea de 2 kV): DPEL-1 56, DPEL-2 51, DPROX-1 91, DPROX-2 300.
    expect(distanciasLineas(2)).toEqual({
      dpel1_cm: 56,
      dpel2_cm: 51,
      dprox1_cm: 91,
      dprox2_cm: 300,
    });
  });

  it('fuera de la tabla o sin tensión: nada', () => {
    expect(distanciasLineas(400)).toBeUndefined();
    expect(distanciasLineas(0)).toBeUndefined();
    expect(distanciasLineas(-5)).toBeUndefined();
    expect(distanciasLineas(Number.NaN)).toBeUndefined();
  });
});

describe('instalación eléctrica provisional (ITC-BT-33 e ITC-BT-24)', () => {
  it('24 V, 30 mA, IP45 y 450/750 V', () => {
    expect(TIERRA_PROVISIONAL.datos).toMatchObject({
      tensionLimite_V: 24,
      sensibilidadBases_mA: 30,
      gradoProteccion: 'IP45',
      cablesExterior: '450/750 V',
      cablesInterior: '300/500 V',
    });
  });

  it('la resistencia de tierra sale de RA × Ia ≤ 24 V: 800 Ω con 30 mA y 80 Ω con 300 mA', () => {
    expect(resistenciaTierraMax(30)).toBe(800);
    expect(resistenciaTierraMax(300)).toBe(80);
    expect(resistenciaTierraMax(0)).toBeUndefined();
    expect(resistenciaTierraMax(Number.NaN)).toBeUndefined();
  });
});

describe('las demás cifras verificadas', () => {
  it('ruido: 80 / 85 / 87 dB(A) y 135 / 137 / 140 dB(C)', () => {
    expect(RUIDO_RD286.datos).toEqual({
      inferior_dBA: 80,
      superior_dBA: 85,
      limite_dBA: 87,
      picoInferior_dBC: 135,
      picoSuperior_dBC: 137,
      picoLimite_dBC: 140,
    });
  });

  it('vibraciones: 2,5 / 5 mano-brazo y 0,5 / 1,15 cuerpo entero', () => {
    expect(VIBRACIONES_RD1311.datos).toEqual({
      manoBrazo: { accion: 2.5, limite: 5 },
      cuerpoEntero: { accion: 0.5, limite: 1.15 },
    });
  });

  it('barandilla de 90 cm desde 2 m; escalera 1 m, 75°, 3,5 m y 5 m; andamio 6, 8, 24 y 6 m; grúa torre 72 km/h', () => {
    expect(BARANDILLA_RD1627.datos).toEqual({ alturaMin_cm: 90, caidaDesde_m: 2 });
    expect(ESCALERA_RD1215.datos).toEqual({
      sobresalir_m: 1,
      angulo_grados: 75,
      anticaidas_m: 3.5,
      sinGarantias_m: 5,
    });
    expect(ANDAMIO_PLAN_RD1215.datos).toEqual({
      altura_m: 6,
      vano_m: 8,
      sobreCubierta_m: 24,
      torreMovil_m: 6,
    });
    expect(VIENTO_GRUA_TORRE.datos).toEqual({
      trabajo_kmh: 72,
      avisoIntermitente_kmh: 50,
      avisoContinuo_kmh: 70,
    });
  });

  it('cada tabla lleva su norma y su fecha de cotejo', () => {
    for (const t of [
      DISTANCIAS_RD614,
      TIERRA_PROVISIONAL,
      RUIDO_RD286,
      VIBRACIONES_RD1311,
      BARANDILLA_RD1627,
      ESCALERA_RD1215,
      ANDAMIO_PLAN_RD1215,
      VIENTO_GRUA_TORRE,
    ]) {
      expect(t.procedencia.db.trim()).not.toBe('');
      expect(t.procedencia.fecha).toBe('2026-10-16');
    }
  });
});
