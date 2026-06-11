/** Nombre de archivo seguro Windows/macOS: sin `\/:*?"<>|`, espacios colapsados. */
export function docFileName(titulo: string, denominacion: string, ext: 'xlsx' | 'docx' | 'bc3'): string {
  const safe = (s: string) =>
    s
      .replace(/[\\/:*?"<>|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const den = safe(denominacion);
  return `${safe(titulo)}${den ? ` - ${den}` : ''}.${ext}`;
}
