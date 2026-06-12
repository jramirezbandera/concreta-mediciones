# Vendor: bc3 (parser FIEBDC-3)

Fork vendorizado de la librería `bc3` (MIT). El importador `.bc3` es el camino
crítico del producto; poseer el parser permite arreglar los quirks del
tokenizador directamente (códigos `-XXX`, bytes de marca de agua, ~M sin código
hijo…) en vez de rodearlos desde `core/bc3import.ts`.

- **Origen:** https://github.com/ogorhc/bc3
- **Versión:** v1.1.0 (commit `943687f20dc483dca8c60eebab3c6ea31ad07079`, vendorizado 2026-06-12)
- **Licencia:** MIT (ver `LICENSE` en esta carpeta; copyright Igor HC)
- **Dependencias de runtime:** ninguna (el fuente no importa nada externo)

## Política

- A partir de aquí este código es NUESTRO: se edita directamente, con tests.
  Cualquier divergencia respecto al upstream se anota abajo.
- Si el upstream publica un fix interesante, se trae a mano (cherry-pick
  manual), no hay sincronización automática.
- ESLint no audita esta carpeta (estilo del upstream ≠ nuestro estilo);
  `tsc` SÍ la compila con el strict del proyecto.

## Divergencias respecto a v1.1.0

- (2026-06-12) Ajustes mecánicos para compilar bajo nuestro tsconfig
  (`verbatimModuleSyntax`: `import type` donde aplique). Sin cambios de
  comportamiento.
- (2026-06-12) **`DParser.looksLikeChildCode`: reconocer códigos con prefijo
  no alfanumérico.** FIEBDC-3 admite casi cualquier carácter en CODIGO y los
  bancos reales lo usan (BCCA: capítulos `-BAS`/`-AUX`/`-UNI` y conceptos con
  un byte no ASCII inicial). El upstream los rechazaba y desalineaba el
  triplete CODE\FACTOR\REND del `~D`: sus factores se leían como «child code
  "1"» (aviso falso) y los conceptos reales se PERDÍAN. Regla nueva: un
  elemento que contiene una letra es un código (FACTOR/REND son siempre
  numéricos). Tests: `core/bc3import.test.ts` (sintéticos «-BAS» y byte raro
  + el BCCA real importa con 0 avisos del parser y recupera los 2 conceptos
  antes perdidos).
