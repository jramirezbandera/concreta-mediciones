/* ===========================================================================
   store/selectors — humo contra el core (auditoría B-08).
   ---------------------------------------------------------------------------
   Los selectores no hacen aritmética propia (delegan en core/), pero
   `_certTotals` cablea DIEZ argumentos posicionales: trasponer `curData`/
   `prevData` o `extras`/`prevExtras` COMPILA y descuadraría todos los totales
   de la UI sin que nada lo detectara. Este humo compara cada selector contra
   la llamada directa al motor con un escenario de 2 certs (valida el cableado
   cur/prev) y verifica la memoización por identidad.
   =========================================================================== */
import { beforeEach, describe, expect, it } from 'vitest';
import { certChapterRows, certSnapshotOf, certTotals } from '../core/certificacion';
import { buildResumen } from '../core/listado';
import { pec, pem, totalConIva } from '../core/totales';
import {
  selectCertChapterRows,
  selectCertTotals,
  selectChapterTotals,
  selectPec,
  selectPem,
  selectResumen,
  selectTotalConIva,
  useObraStore,
} from './index';

const state = () => useObraStore.getState();

beforeEach(() => {
  state().reset();
});

/** Escenario con historia: cert 0 con cantidad + contradictorio, cert 1 encima. */
function withTwoCerts() {
  state().setCurCert(0);
  state().onCertEdit('p111', 7, 'origen');
  state().addContradictorio('01');
  const ex = state().certs[0]!.extras![0]!;
  state().editContradictorio(ex.id, 'cantidad', 2);
  state().editContradictorio(ex.id, 'precio', 50);
  state().addCert(); // cert 1 hereda data/extras/snapshot; curCert = 1
  state().onCertEdit('p111', 9, 'origen');
}

describe('selectors — humo contra el core (B-08)', () => {
  it('selectPem/selectPec/selectTotalConIva/selectChapterTotals == core', () => {
    const s = state();
    const pemC = pem(s.partidas, s.rates.coefK);
    expect(selectPem(s)).toBe(pemC);
    expect(selectPec(s)).toBe(pec(pemC, s.rates));
    expect(selectTotalConIva(s)).toBe(totalConIva(pemC, s.rates));
    // Σ por capítulo == PEM (coherencia interna)
    expect(Object.values(selectChapterTotals(s)).reduce((a, b) => a + b, 0)).toBe(pemC);
  });

  it('selectCertTotals cablea cur/prev/extras/snapshot/ajustes en el orden correcto', () => {
    withTwoCerts();
    const s = state();
    const cur = s.certs[s.curCert]!;
    const prev = s.certs[s.curCert - 1]!;
    const direct = certTotals(
      Object.values(s.partidas).flat(),
      cur.data,
      prev.data,
      s.rates,
      cur.retencion,
      s.rates.coefK,
      cur.extras ?? [],
      prev.extras ?? [],
      certSnapshotOf(cur, s.rates.coefK),
      cur.ajustes ?? [],
    );
    expect(selectCertTotals(s)).toEqual(direct);
    // el escenario de verdad distingue cur de prev (si se traspusieran, difiere)
    expect(direct.pecEsta).not.toBe(0);
    expect(direct.pecPrev).not.toBe(0);
  });

  it('selectCertChapterRows == core con el snapshot de la cert en curso', () => {
    withTwoCerts();
    const s = state();
    const cur = s.certs[s.curCert]!;
    const prev = s.certs[s.curCert - 1]!;
    const direct = certChapterRows(
      s.chapters,
      s.partidas,
      cur.data,
      prev.data,
      s.rates.coefK,
      cur.extras ?? [],
      certSnapshotOf(cur, s.rates.coefK),
    );
    expect(selectCertChapterRows(s)).toEqual(direct);
  });

  it('selectResumen == buildResumen', () => {
    const s = state();
    expect(selectResumen(s)).toEqual(buildResumen(s.chapters, s.partidas, s.rates));
  });

  it('memoización: mismo estado ⇒ mismo objeto (identidad, no solo igualdad)', () => {
    withTwoCerts();
    const s = state();
    expect(selectCertTotals(s)).toBe(selectCertTotals(s));
    expect(selectCertChapterRows(s)).toBe(selectCertChapterRows(s));
    expect(selectResumen(s)).toBe(selectResumen(s));
    // y una mutación de dominio invalida el memo
    state().onCertEdit('p112', 1, 'origen');
    expect(selectCertTotals(state())).not.toBe(selectCertTotals(s));
  });
});
