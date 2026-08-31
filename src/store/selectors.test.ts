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
import {
  certChapterRows,
  certSnapshotOf,
  certTotals,
  retenidoAcumulado,
} from '../core/certificacion';
import { buildResumen } from '../core/listado';
import { costesDirectos, pec, pem, totalConIva } from '../core/totales';
import {
  selectCertChapterRows,
  selectCertTotals,
  selectChapterTotals,
  selectCostesDirectos,
  selectCostesIndirectos,
  selectPec,
  selectPem,
  selectResumen,
  selectRetenidoAcumulado,
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
    const cd = costesDirectos(s.partidas, s.rates.coefK);
    expect(selectCostesDirectos(s)).toBe(cd);
    expect(selectPem(s)).toBe(pem(cd, s.rates));
    expect(selectPec(s)).toBe(pec(selectPem(s), s.rates));
    expect(selectTotalConIva(s)).toBe(totalConIva(selectPem(s), s.rates));
    // Σ por capítulo == costes directos (coherencia interna)
    expect(Object.values(selectChapterTotals(s)).reduce((a, b) => a + b, 0)).toBe(cd);
  });

  it('con CI de obra el PEM sube sobre los capítulos y arrastra GG/BI/IVA', () => {
    state().setRates({ ci: 0.03 });
    const s = state();
    const cd = selectCostesDirectos(s);
    expect(selectCostesIndirectos(s)).toBe(pem(cd, s.rates) - cd);
    expect(selectPem(s)).toBeGreaterThan(cd);
    expect(selectPec(s)).toBe(pec(selectPem(s), s.rates));
    // La Σ de capítulos NO se mueve: el CI es una línea de obra, no un precio.
    expect(Object.values(selectChapterTotals(s)).reduce((a, b) => a + b, 0)).toBe(cd);
    state().setRates({ ci: 0 });
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

  it('selectRetenidoAcumulado == core y cruza SOLO las certs ≤ curCert', () => {
    // El seed retiene al 5% en las 3 certs → hay retención → no es null.
    withTwoCerts(); // curCert = 1
    const s = state();
    const direct = retenidoAcumulado(Object.values(s.partidas).flat(), s.certs, s.curCert, s.rates);
    expect(selectRetenidoAcumulado(s)).toBe(direct);
    // en la cert 0 el acumulado es menor (no ve la cert 1)
    state().setCurCert(0);
    expect(selectRetenidoAcumulado(state())!).toBeLessThan(direct);
  });

  it('selectRetenidoAcumulado es null cuando la obra no ha tenido retención', () => {
    useObraStore.setState((s) => ({ certs: s.certs.map((c) => ({ ...c, retencion: 0 })) }));
    expect(selectRetenidoAcumulado(state())).toBeNull();
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
