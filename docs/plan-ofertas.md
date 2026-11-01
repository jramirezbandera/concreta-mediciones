# Plan · Mediciones sin precios y comparativo de ofertas

> Estado: EN CURSO (2026-11-01). Sale de `TODOS.md`, «Documentos que aún obligan a volver a
> Presto o a Excel». Obra privada: se piden ofertas a constructoras, no hay licitación ni baja
> de adjudicación.

## Petición

Mandar las mediciones a varias constructoras, recibir lo que devuelve cada una y ver, partida a
partida, dónde se desvía cada oferta del presupuesto y de las demás. Hoy eso obliga a volver a
Presto o a montar un Excel a mano.

## Objetivo medible

- Desde «Exportar», el documento «Mediciones sin precios» sale en PDF, Word, Excel y .bc3. El
  Excel trae la columna Precio vacía y el importe y los totales como fórmulas: la constructora
  teclea los precios y la hoja suma sola. El .bc3 abre en Presto con todas las partidas a 0 €, su
  texto y su medición.
- Un .bc3 o el Excel de vuelta entra como oferta de una empresa, se guarda con la obra y casa con
  las partidas del presupuesto sin tocarlo.
- La vista «Ofertas» compara cada partida (presupuesto frente a cada oferta), marca la oferta más
  barata y las desviaciones, y avisa de lo que no casa o viene sin precio.

## Diseño

### O1 · Mediciones sin precios

- `PrintTarget` gana `{ kind: 'mediciones' }`. Usa el mismo listado que «Presupuesto y
  mediciones» (`buildPresupuestoListado`) y cada pintor lo pinta sin dinero:
  - PDF y Word: sin columnas Precio e Importe ni totales; la descripción gana ese ancho.
  - Excel: la columna Precio va vacía y el importe, los subtotales y el total siguen siendo
    fórmulas (con la cantidad como fórmula de la medición, igual que hoy).
  - Sin pie de firma (aún no hay constructora) y sin «Constructora» en la cabecera.
- `.bc3` sin precios: `obraToBc3(…, { sinPrecios: true })`. Las partidas van a 0 € sin
  descomposición (Presto recalcula el padre desde los hijos), los contenedores y la raíz a 0 y
  el `~K` sin costes indirectos (si no, Presto se los sumaría a los precios de la constructora).
  Los códigos se asignan igual que en el .bc3 completo: así casa la oferta (O2).

### O2 · Ofertas en la obra

- Esquema v10: `ofertas?: Oferta[]` en `ObraData` (en `DOMAIN_KEYS`: autosave, Deshacer y
  solo lectura sin tocar nada más).

  ```ts
  interface Oferta {
    id: string;
    empresa: string;
    fecha: string;          // ISO, cuando entró
    fichero: string;
    precios: Record<string, number>;      // id de partida → precio unitario ofertado (€, PEM)
    cantidades: Record<string, number>;   // solo las que la oferta trae distintas
    sinCasar: OfertaFila[];               // partidas de la oferta que no son nuestras
    pemDeclarado: Cents | null;           // el total del fichero, si lo trae
  }
  ```

- Casar al importar, una vez (el resultado se guarda; cambiar el presupuesto después no lo
  recalcula, y una partida nueva sale «sin precio en esta oferta»):
  1. por el código que el .bc3 sin precios le dio a la partida (`bc3CodigosPartidas`, la misma
     asignación que `obraToBc3`, homónimos `.2` incluidos);
  2. si no, por título y unidad normalizados, cuando el emparejamiento es único;
  3. lo que queda, a `sinCasar`.
- El precio ofertado es el unitario de ejecución material que deja `bc3ToObra` (con los costes
  indirectos del `~K` de la constructora ya dentro, como en cualquier importación).
- Comparar con nuestras cantidades: importe de la oferta = Σ round(cantidad nuestra × precio
  ofertado). Si la constructora cambió cantidades, se avisa por partida y su total con sus
  cantidades sale aparte.
- Vista «Ofertas»: pestaña principal tras «Resumen» (en el móvil, en el menú «Más»). Una
  columna por oferta: precio, importe y desviación sobre el presupuesto; el precio más bajo de
  cada fila resaltado; cabecera con el total de cada oferta y su desviación; avisos por oferta
  (sin precio, sin casar, cantidades distintas). Renombrar o quitar una oferta.

### O3 · Excel de vuelta

- Leer el .xlsx que generó O1 ya relleno: `fflate` (ya es dependencia) + el XML de la hoja y
  de `sharedStrings`. Se busca la fila de cabecera (Nº, Código, …, Precio) de cada capítulo y se
  toma Código → Precio. Mismo casamiento que O2.

### O4 · Comparativo a Excel

- El cuadro de la vista en una hoja con fórmulas, para mandarlo a la propiedad.

## Fuera de alcance

- Precios de una oferta que pasen al presupuesto («adjudicar»): después, si hace falta.
- GG, BI y descuentos por oferta: se compara en ejecución material.
- Ofertas en PDF.

## Tests

- O1: el listado sin precios no lleva importes en PDF/Word; el Excel deja Precio vacío y
  mantiene las fórmulas; el .bc3 sin precios reimporta con PEM 0, las mismas partidas, textos y
  mediciones, y con los mismos códigos que el completo.
- O2: casar por código (con homónimos `.2`), por título y unidad, y lo que no casa; total
  comparado con nuestras cantidades; migración v9 → v10; la oferta se deshace con Deshacer.
- O3: leer el Excel de O1 con precios tecleados.
