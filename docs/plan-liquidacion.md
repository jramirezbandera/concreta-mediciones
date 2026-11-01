# Plan · Liquidación final

> Estado: HECHO (2026-11-01). Sale de `TODOS.md`, «Documentos que aún obligan a volver a
> Presto o a Excel». Obra privada: no hay baja de adjudicación ni revisión de precios.

## Petición

Al acabar la obra, un documento que ponga frente a frente lo presupuestado y lo ejecutado a
origen, partida a partida, con el exceso o el defecto de cada una y el resumen económico, para
cerrar cuentas con la propiedad.

## Diseño

- **De dónde sale:** de la ÚLTIMA certificación (a origen), con los mismos datos que su
  documento (`buildCertListado`): cantidades ejecutadas, precios congelados al certificar,
  partidas cerradas, precios contradictorios y partidas eliminadas del presupuesto.
- **Presupuestado:** la cantidad y el importe del presupuesto actual (precio × K), como en el
  documento del presupuesto.
- **Por partida:** presupuestado (cantidad, importe), ejecutado (cantidad, importe), diferencia
  (cantidad, importe) y % ejecutado, con su estado: igual, exceso, defecto, no ejecutada
  (cerrada sin nada hecho), precio contradictorio o eliminada del presupuesto.
- **Resumen:** costes directos, CI, PEM, GG + BI, PEC, IVA y total de los dos lados y su
  diferencia; la garantía retenida acumulada, informativa, y cuántas partidas van con exceso,
  con defecto, sin ejecutar y contradictorias.
- **Salidas:** «Liquidación final» en Exportar (PDF, Word y Excel), solo si hay alguna
  certificación. El Excel con fórmulas, como el resto.

## Fuera de alcance

- Elegir otra certificación que no sea la última.
- Recepción, plazo de garantía y devolución de la garantía como acto: solo se informa el importe.

## Tests

- El cálculo: estados, exceso/defecto, contradictorios y eliminadas sin presupuestado, los
  totales cuadran con la última certificación (PEM y PEC a origen).
- Cada formato: título, columnas y totales; el Excel con fórmulas.
