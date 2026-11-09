---
name: mediciones
description: Montar, medir y revisar el presupuesto de una obra de Concreta Mediciones (capítulos, partidas, líneas de medición, precios, certificaciones) con las herramientas del MCP concreta-mediciones, sobre un fichero <obra>.mediciones.json en la carpeta de la obra. Úsala cuando haya que crear o cambiar partidas o mediciones, leer el presupuesto o comprobar qué le falta.
---

# Concreta Mediciones: el presupuesto de una obra

Trabajas sobre **un fichero `<obra>.mediciones.json`** en la carpeta de la obra. Es la obra entera: capítulos, partidas, mediciones, precios, certificaciones y la ficha. El técnico la tiene abierta en la app (Concreta Mediciones, en el navegador), y lo que cambias aparece allí.

## Reglas

1. **Los precios no salen de tu memoria.** Un precio lo da el técnico o sale de una base de precios que te haya pasado. Si no lo tienes, crea la partida sin precio y dilo al final: `validar` la lista como «sin precio».
2. **Las mediciones no se inventan.** Cada línea sale de una cota que te da el técnico o de un documento que has leído, y su `comentario` dice de dónde: «Planta baja · eje A (plano A-02)». Si una cifra no se lee o falta, pregunta. Medir sobre el plano calibrado lo hace el técnico en la app.
3. **Lee justo antes de cambiar.** El técnico puede haber cambiado la obra desde la app: no trabajes de memoria con números de partida o de línea de hace un rato. «Esta partida», «aquí» o «estas líneas» se resuelven con `seleccion`, nunca adivinando.
4. **El fichero no se toca a mano.** Ni con herramientas de ficheros ni con scripts: solo con `editar`. Tiene datos que dependen unos de otros (la numeración, el precio del descompuesto, lo certificado) y una edición a mano los rompe sin aviso.
5. **Lo certificado no se toca sin que lo pida el técnico.** Cambiar la medición o la cantidad de una partida certificada, o borrarla, exige `forzar: true`, y eso solo cuando él lo ha pedido. Una certificación emitida está cerrada: solo él puede reabrirla.
6. **Lotes pequeños.** Una partida con sus líneas, o unas pocas, por cada `editar`. El técnico ve crecer la obra y cada lote se deshace por separado.
7. **Obra privada.** Nada de licitación ni de baja de adjudicación.

## Cómo se trabaja

1. **La obra.** `obra` con la carpeta te dice qué fichero es, cómo se llama y qué tiene. Si no hay ninguno, `nueva_obra` lo crea; si hay varios, pregunta cuál.
2. **Lo que tiene abierto el técnico.** Si habla de «esta partida», «este capítulo» o «estas líneas», `seleccion` te da la partida abierta (su número, su `id`, su título y las líneas que tiene elegidas), el capítulo, la certificación en curso y el plano. Nombra la partida por su `id`: vale aunque la numeración cambie. Si `alDia` es false o trae `avisos`, el técnico tiene cambios que aún no han llegado al fichero; si la partida no está en el fichero (`enElFichero: false`), espera un par de segundos y vuelve a pedirla. Con `abierta: false`, pregúntale a cuál se refiere.
3. **Lo que hay.** `resumen` (importes y capítulos) y `arbol` (capítulos, subcapítulos y partidas con su cantidad, precio e importe). Para una partida concreta, `partida`, con sus líneas una a una y su descompuesto. `buscar` encuentra partidas por texto o código.
4. **Cambiarlo.** `editar` con una lista de operaciones. Van en orden, todas o ninguna: si una falla, no se guarda nada y el resultado dice cuál y por qué. Corrígela y repite el lote.
5. **Comprobarlo.** `validar` da los errores (no debería haber ninguno) y los avisos de lo que falta (partidas sin precio, sin medición, sin unidad, capítulos vacíos). Al terminar, cuenta al técnico lo que has hecho y lo que queda.

## Las referencias

- **Una partida:** su número en el árbol, como lo ve el técnico («1.2.3»), o su `id`.
- **Un capítulo o subcapítulo:** su código («2», «2.1»), su título exacto o su `id`.
- **Una línea:** su número en la partida, desde 1, en el momento de aplicar la operación. Dentro de un lote, las operaciones ven lo que hicieron las anteriores: si borras la línea 1, la que era la 2 pasa a ser la 1.
- Los números cambian al mover o borrar. Cada recibo de `editar` da el número (`ref`) y el `id` de lo que creó o tocó.

## Las operaciones de `editar`

```json
{ "op": "crear_capitulo", "titulo": "Movimiento de tierras" }
{ "op": "crear_subcapitulo", "padre": "1", "titulo": "Excavaciones" }
{ "op": "crear_partida", "capitulo": "1.1", "codigo": "ADE010", "titulo": "Excavación en zanjas", "ud": "m³",
  "precio": 18.5, "descripcion": "Excavación en zanjas para cimentaciones…",
  "lineas": [{ "comentario": "Zanja eje A", "uds": 1, "largo": 12, "ancho": 0.6, "alto": 0.8 }] }
{ "op": "agregar_lineas", "ref": "1.1.1", "lineas": [{ "comentario": "Zanja eje B", "uds": 2, "largo": 8, "ancho": 0.6, "alto": 0.8 }] }
{ "op": "editar_linea", "ref": "1.1.1", "indice": 2, "campo": "largo", "valor": 8.4 }
{ "op": "borrar_linea", "ref": "1.1.1", "indice": 2 }
{ "op": "borrar_lineas", "ref": "1.1.1", "indices": [2, 3] }
{ "op": "editar_partida", "ref": "1.1.1", "campo": "titulo", "valor": "Excavación de zanjas en terreno compacto" }
{ "op": "set_precio", "ref": "1.1.1", "valor": 19.2 }
{ "op": "set_cantidad", "ref": "2.1", "valor": 1 }
{ "op": "duplicar_partida", "ref": "1.1.1" }
{ "op": "mover_partida", "ref": "1.1.2", "destino": "2" }
{ "op": "borrar_partida", "ref": "1.1.2" }
{ "op": "renombrar", "ref": "1.1", "titulo": "Excavaciones y rellenos" }
{ "op": "borrar_contenedor", "ref": "3" }
{ "op": "set_porcentajes", "gg": 13, "bi": 6, "iva": 10 }
{ "op": "set_coef_k", "valor": 1 }
{ "op": "editar_obra", "campo": "promotor.nombre", "valor": "Promociones Sur SL" }
{ "op": "crear_certificacion", "periodo": "octubre 2026" }
{ "op": "certificar", "ref": "1.1.1", "valor": 6, "modo": "origen" }
{ "op": "certificar_100", "ambito": "capitulo", "ref": "1" }
```

- **Líneas.** `comentario` y las dimensiones `uds`, `largo`, `ancho` y `alto`. Una dimensión que no se da cuenta como 1 (una línea sin ninguna vale 0), y un 0 anula la línea. El parcial es su producto, y la cantidad de la partida, la suma de sus líneas.
- **`set_cantidad`** es solo para una partida sin líneas, con una cantidad fija: 1 ud, una partida alzada. Si la partida tiene medición, su cantidad sale de las líneas.
- **`editar_partida`:** `campo` es `titulo`, `ud`, `codigo` o `descripcion`. **`editar_linea`:** `comentario`, `uds`, `largo`, `ancho` o `alto`.
- **`set_porcentajes`** va en %: 13 es el 13 %. `gg` son los gastos generales; `bi`, el beneficio industrial; `iva`, el IVA; `ci`, los costes indirectos (dentro del PEM).
- **`set_coef_k`** escala todos los precios para cuadrar el PEM a una cifra (1 = sin ajuste). Solo si el técnico lo pide.
- **`editar_obra`:**
  - campos de texto: `denominacion`, `direccion`, `localidad`, `provincia`, `refCatastral`, `expediente`, `notes`, y los de `promotor.` y `constructor.`;
  - campos numéricos: `superficieConstruida` (m²), `plantasSobreRasante` y `plantasBajoRasante`.
- **`borrar_contenedor`** solo borra un capítulo o subcapítulo vacío: mueve o borra antes sus partidas.
- **`certificar`** va sobre la certificación en curso, que es la última. `modo` es `origen` (la cantidad acumulada hasta hoy) o `esta` (la de este periodo).
- **`certificar_100`** completa al 100 % un `ambito`: `obra`, `capitulo` (con `ref`) o `subarbol` (con `ref`).

Sin `codigo`, una partida nueva lleva uno libre (P001, P002…). Si la partida sale de una base de precios, pon su código.

## La app

La app es <https://jramirezbandera.github.io/concreta-mediciones/>, y `abrir_app` la abre. En Chrome y Edge abre la obra desde su carpeta y la vigila.

- **Si la obra está abierta en la app desde su carpeta**, cada `editar` aparece allí en uno o dos segundos, resaltado y con un aviso. El técnico lo deshace con Ctrl+Z.
- **Si la obra está en la app pero no en una carpeta**, tú no la ves. Pídele que la pase a la carpeta de la obra: en el selector de obras, «Pasar a una carpeta». Allí queda su `<obra>.mediciones.json`. Si no, crea una con `nueva_obra`.
- **Para abrir en la app una obra que has creado tú**, el técnico usa «Abrir carpeta» en el selector de obras y elige su carpeta. Por seguridad, el navegador no deja abrirla por su ruta.
- **Podéis trabajar a la vez.** Si el técnico tiene cambios que aún no están en el fichero cuando escribes, la app repite tus operaciones sobre los suyos y guarda las dos cosas: no se pierde nada ni se le pregunta. Por eso cada lote queda en el diario de la carpeta (`.mediciones/diario/`), con lo que creó con el mismo `id` en los dos lados.
- **Solo se le pregunta** si una operación tuya ya no se puede repetir, porque él acaba de borrar la partida o la línea que tocabas. Si te dice que no ve tus cambios, que mire el aviso «Revisar» junto al nombre de la obra, y vuelve a leerla antes de repetir nada.
- **Tras volver a abrir el navegador**, la app pide un clic para usar otra vez la carpeta: «Conectar», junto al nombre de la obra.
