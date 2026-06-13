# Conceptos paramétricos FIEBDC (`~P`) — investigación y plan de scope

Estado: **INVESTIGADO, NO implementado** (2026-06-13). Disparado por el import
de `centro2017_clasica.bc3` (Precio Centro 2017, Menfis 8.2), que generó 4.044
avisos del parser. El resumen de avisos por categoría YA está implementado
(`summarizeParserWarnings`, `core/bc3import`); esto documenta el soporte
paramétrico en sí, que queda pendiente de decisión.

## Qué es un concepto paramétrico

FIEBDC-3 permite conceptos configurables: una "VENTANA ALUMINIO" con parámetros
(ACABADO, SISTEMA…) que el usuario elige, generando una variante concreta.

- **Registro `~P`** define el menú de UN parámetro de un concepto:
  ```
  ~P|E14AVA#|\ACABADO\anodizado natural\anodizado bronce\lacado blanco\lacado color\imitación madera\
  ~P|E14AVO#|\SISTEMA\corredera\corredera monobloc\practicable\oscilobatiente\basculante\pivotante\
  ```
  Formato: `~P|CÓDIGO#|\NOMBRE_PARÁMETRO\opción1\opción2\…\`. **Solo texto: sin precios.**
- El concepto paramétrico (`~C|E14AVA#|u|VENTANA ALUMINIO CORREDERA|…`) lleva en
  su `~D` la lista de variantes pre-combinadas, codificadas con un sufijo:
  ```
  ~D|E14AVA#|E14A20aacc\\\E14A20aadc\\\E14A20abcc\\\…\
  ```
  Base `E14A20` + sufijo (`aacc`, `aadc`…) donde cada par de letras = una opción
  elegida de cada parámetro (varios parámetros por concepto).

## Hallazgo crítico (gobierna la decisión)

En este export las variantes **no están definidas**: medido sobre el archivo,

- **2.531 códigos de variante únicos referenciados** en `~D`.
- **0 de ellos tienen `~C`** (ni precio, ni descripción, ni descomposición).
- Los `~P` (16) traen los menús de parámetros pero **ningún precio**.
- La base (`E14A20`) tampoco existe como `~C`/`~D`.

→ **Expandir los paramétricos contra este `.bc3` no recupera ninguna partida
con precio**: el dato priceado no viaja en la exportación "clásica" de Menfis
(probablemente requiere el programa o un modo de export distinto). El import
actual ya trae las partidas NO paramétricas correctamente (62.922 partidas).

## Opciones

### A — Reconocer paramétricos (contenido, honesto)
Parsear `~P`; marcar los conceptos paramétricos y sus referencias de variante.
Valor:
- **Clasificar** las 2.531 referencias como "variante paramétrica (sin definir
  en este .bc3)" en vez de mezclarlas con huérfanos reales — así, si algún día
  falta una partida de VERDAD (bug), no queda enterrada bajo el ruido paramétrico.
- Exponer los menús de parámetros como metadato del concepto (para una futura UI
  "esto es configurable").
- **No** produce partidas con precio (el dato no está).

Coste: bajo-medio. Riesgo: bajo. No desbloquea uso real (sigue sin precios).

### B — Configurador paramétrico completo
Expandir variantes a partidas reales con su precio. **Solo justificable si existe
un export de Menfis que SÍ traiga las variantes priceadas** (`~C` de cada variante
o una fórmula de precio). Con el archivo actual no hay nada que expandir.
Coste: alto (subsistema entero: modelo de parámetros, expansión, UI de selección).
Bloqueado por: conseguir una muestra `.bc3` con variantes priceadas.

## Recomendación

1. **Ya hecho:** el resumen de avisos (`summarizeParserWarnings`) convierte los
   4.044 avisos en 2 líneas honestas ("2.562 variantes paramétricas no
   expandidas — las partidas base sí se importan" + "1.482 registros ~F/~P
   ignorados"). Esto cubre el susto inmediato del usuario.
2. **A** es polish opcional: mejora la precisión del diagnóstico, no desbloquea
   uso. Hacerlo solo si el ruido paramétrico llega a estorbar de verdad.
3. **B** queda DIFERIDO hasta tener una muestra con variantes priceadas. Sin esa
   muestra no se puede ni diseñar la expansión (no sabemos de dónde sale el precio).

Acción concreta para desbloquear B: pedir/exportar desde Menfis un `.bc3` de una
familia paramétrica CON precios y volver a medir el `conC` (variantes con `~C`).
