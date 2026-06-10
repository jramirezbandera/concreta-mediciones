/** Descarga un blob como archivo (anchor temporal; mismo patrón que las libs). */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  // Margen para Firefox antes de revocar la URL y retirar el anchor.
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 100);
}
