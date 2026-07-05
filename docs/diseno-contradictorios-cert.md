# Diseño — Mejora de precios contradictorios en Certificaciones

> Fecha: 2026-07-05 · Estado: aprobado (office-hours) · Autor: jramirez
> Alcance: F4.4 (contradictorios cert-local). Solo diseño — sin código.

## Problema

Dos fricciones al trabajar con precios contradictorios (P.C.) en la cert:

1. **Unidades por texto libre.** Al editar la «Ud.» de un contradictorio aparece
   un cuadro de texto libre (`EditableText`). El resto de la app ya usa un
   selector de unidad (`UdSelect`), así que el contradictorio quedó descolgado.
2. **Capítulo vacío = callejón sin salida.** Un capítulo sin partidas se oculta
   en «Toda la obra», y al aislarlo desde el árbol solo se ve el mensaje «Este
   capítulo no tiene partidas que certificar» — sin forma de añadirle un P.C.

## Contexto de código (dónde está hoy)

- Unidad libre del contradictorio:
  - Desktop: `src/features/certificaciones/CertTable.tsx` → `CertExtraRow`, celda `Ud.` (~L307-314).
  - Móvil: `src/features/certificaciones/CertCard.tsx` → `CertExtraCard`, stat `Ud.` (~L209-213).
- Selector reutilizable ya existente: `src/components/UdSelect.tsx`
  (docstring: «Sustituye al texto libre de F8.0 — teclear m2/M2/m^2 a mano
  fragmentaba las unidades»). Usado en presupuesto:
  `src/features/presupuesto/PartidaRow.tsx` (~L109-113).
- Ocultado del capítulo vacío en «Toda la obra»:
  `src/features/certificaciones/CertificacionesView.tsx` L203 (`return null`).
- Rama de estado vacío (sin botón de alta):
  `CertificacionesView.tsx` L242-246. El botón «Añadir precio contradictorio»
  vive dentro de `CertChapterTable`/`CertChapterCards`, que NO se renderizan en
  esa rama.
- El capítulo vacío SÍ es alcanzable: la Sidebar pinta todos los capítulos
  (`src/layout/Sidebar.tsx` L179) y en modo cert seleccionar aísla en vez de
  saltar al presupuesto (`Sidebar.tsx` L116-117).
- Acción de alta: `addContradictorio(chapterId)` en
  `src/store/slices/certSlice.ts` (L259) — los P.C. son de ámbito **capítulo**
  (`CertExtra.chapterId`), nunca de subcapítulo.

## Premisas (confirmadas)

1. Cambio 1 = **reutilizar `UdSelect`** en los dos sitios del contradictorio. Sin
   componente nuevo. Misma firma: `onCommit={(v) => editContradictorio(e.id, 'ud', v)}`.
2. Cambio 2 = **problema de afordancia, no de navegación.** El capítulo vacío ya
   es alcanzable; ocultarlo en «Toda la obra» es deliberado (18 capítulos, la
   mayoría vacíos) y se mantiene.
3. Los contradictorios siguen siendo **de capítulo** (`chapterId`). No de sub, no
   en un bucket global.

## Decisión (Opción A)

Al aislar un **capítulo** vacío desde el árbol, su sección muestra el estado
vacío **más** el botón «Añadir precio contradictorio». Sin tocar el ocultado de
«Toda la obra»: en cuanto exista un P.C., `chExtras.length > 0` y el capítulo
reaparece solo en la vista global (L203 ya lo contempla).

Descartadas:
- **B (siempre visible):** añade 10+ bandas vacías con botón a la cert. Ruido.
- **C (botón global + selector):** más descubrible pero es UI nueva y un patrón
  que no encaja con cómo ya se navega la cert (aislar desde el árbol).

## Plan de implementación

### Cambio 1 — Unidad con selector (bajo riesgo, va primero)

En `CertExtraRow` (CertTable) y `CertExtraCard` (CertCard), sustituir el
`EditableText` de la celda/stat `Ud.` por `UdSelect`:

```tsx
// antes
<EditableText value={e.ud} ariaLabel="Unidad" placeholder="ud"
  onCommit={(v) => editContradictorio(e.id, 'ud', v)} />
// después
<UdSelect value={e.ud} ariaLabel="Unidad"
  onCommit={(v) => editContradictorio(e.id, 'ud', v)} />
```

Notas:
- `UdSelect` ya usa popover en posición fija y se cierra al hacer scroll →
  funciona dentro de la tabla de cert (overflow). Sin cambios extra.
- La navegación por Tab del grid usa `data-col`; la celda `Ud.` no lo tiene, así
  que el orden de tabulación no cambia. El trigger de `UdSelect` ya emite
  `data-editcell`.
- Quitar el import de `EditableText` si queda sin uso en cada fichero; añadir
  `UdSelect` (ya exportado desde `../../components`).

### Cambio 2 — Alta de P.C. en capítulo vacío aislado (Opción A)

Único punto de cambio: la rama de estado vacío en `CertificacionesView.tsx`
(L242-246). Cuando el capítulo esté vacío:

- Mantener el mensaje amable.
- Si `activeChapter && !focusSub` (aislado a un capítulo, no a un sub), renderizar
  también el botón «Añadir precio contradictorio» que llame a
  `addContradictorio(ch.id)`.
- Si es un **sub** aislado vacío (`focusSub != null`): solo el mensaje, sin botón
  (los contradictorios no cuelgan de subs — premisa 3).

Boceto:

```tsx
{ps.length === 0 && chExtras.length === 0 ? (
  <div className={styles.chapEmptyWrap}>
    <p className={styles.chapEmpty}>
      {focusSub ? 'Este subcapítulo' : 'Este capítulo'} no tiene partidas que certificar.
    </p>
    {activeChapter && !focusSub && (
      <button type="button" className={`tcol ${styles.addBtn}`}
        onClick={() => addContradictorio(ch.id)}>
        <Icon name="plus" size={13} /> Añadir precio contradictorio
      </button>
    )}
  </div>
) : compact ? ( /* … */ ) : ( /* … */ )}
```

Notas:
- `addContradictorio` ya se importa en `CertChapterTable`/`CertChapterCards`;
  aquí hará falta traerlo al scope de `CertificacionesView` (o extraer un
  pequeño `AddContradictorioButton` reutilizado por los tres sitios para no
  duplicar estilos — opcional, DRY).
- Reutilizar el estilo `addBtn` existente (o `cardsAdd` en compacto) para que el
  botón case con el que ya sale al pie de un capítulo con partidas.
- No se toca L203 ni la lógica de `CertChapterTable`/`CertChapterCards`.

## Casos borde / a verificar

- Añadir P.C. a capítulo vacío → aparece la fila; el capítulo pasa a verse en
  «Toda la obra» (chExtras>0).
- Borrar el último P.C. del capítulo → `deleteContradictorio` deja `extras`
  vacío; el capítulo vuelve a ocultarse en «Toda la obra» y, al aislarlo, el
  botón de alta sigue disponible.
- Aislar un **sub** vacío → solo mensaje, sin botón.
- Modo compacto (tarjetas): la rama vacía es la misma en `CertificacionesView`,
  así que el fix cubre desktop y móvil de una vez. Usar `cardsAdd` para el botón
  en compacto si se quiere paridad visual.
- **Exportación**: comprobar que un P.C. en un capítulo por lo demás vacío sale
  bien en `PrintCert`, `docxRender` y `xlsxBuilders` (que la banda del capítulo
  no se colapse dejando el P.C. huérfano). Es el borde con más riesgo real.

## Tests a añadir

- `CertExtraRow`/`CertExtraCard`: la celda `Ud.` abre el listbox de `UdSelect`
  (no un textarea); elegir «m²» dispara `editContradictorio(id,'ud','m²')`.
- `CertificacionesView`: capítulo vacío aislado muestra el botón de alta; sub
  vacío aislado no; pulsar el botón añade un `CertExtra` con `chapterId` correcto.
- Regresión: capítulo vacío en «Toda la obra» sigue oculto hasta que tenga un P.C.
- Ficheros de test relevantes: `Certificaciones.test.tsx`, `CertGridTab.test.tsx`,
  `certSlice`/`obraStore.test.ts`.

## Riesgo y orden

- Cambio 1: trivial (swap de componente), sin lógica. Va primero, se puede
  soltar solo.
- Cambio 2: un fichero, una rama; el resto de la vista intacto.
- Sin conflicto con el trabajo en curso (MassComplete/completeScope/obraStore):
  toca ficheros distintos.
