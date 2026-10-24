/* Comprueba que las bases oficiales del catálogo (`src/core/basesOficiales.ts`)
   se siguen pudiendo descargar desde la app (docs/plan-bases-oficiales.md, D10).

   Por cada base con `descarga`, un HEAD a su URL:
     · con `Accept-Encoding: identity`: si no, Extremadura la sirve con gzip y
       no dice cuánto pesa;
     · con un `Origin` de prueba: la app la descarga desde el navegador, así que
       sin `Access-Control-Allow-Origin` el botón no funciona.
   Avisa de un estado distinto de 200, una redirección, un tamaño distinto de
   `bytes` o la CORS perdida. Para las bases sin `descarga` (Madrid), solo que
   su `pagina` responde 200.

   Se lanza a mano (no en la CI, que no debe depender de webs ajenas), p. ej.
   antes de publicar una edición nueva en el catálogo:
     node scripts/bases/comprobar.mjs
   Sale con 0 si todo cuadra y con 1 si algo ha cambiado. Necesita Node ≥ 23.6
   (importa el catálogo .ts tal cual). */
import { BASES_OFICIALES } from '../../src/core/basesOficiales.ts';

const ORIGEN = 'https://comprobar.concreta.test';
const AGENTE = 'concreta-mediciones/comprobar-bases';

async function head(url, cabeceras = {}) {
  return fetch(url, {
    method: 'HEAD',
    redirect: 'manual',
    headers: { 'User-Agent': AGENTE, ...cabeceras },
    signal: AbortSignal.timeout(30_000),
  });
}

async function comprobar(base) {
  const fallos = [];
  if (!base.descarga) {
    const r = await head(base.pagina);
    if (r.status !== 200) fallos.push(`la página responde ${r.status}`);
    return fallos;
  }
  const { url, bytes } = base.descarga;
  const r = await head(url, { 'Accept-Encoding': 'identity', Origin: ORIGEN });
  if (r.status >= 300 && r.status < 400) {
    fallos.push(`redirige a ${r.headers.get('location') ?? '¿?'}`);
    return fallos;
  }
  if (r.status !== 200) {
    fallos.push(`responde ${r.status}`);
    return fallos;
  }
  const largo = Number(r.headers.get('content-length'));
  if (!largo) fallos.push('no dice su tamaño (Content-Length)');
  else if (largo !== bytes) fallos.push(`pesa ${largo} bytes y el catálogo dice ${bytes}: ¿edición nueva?`);
  const cors = r.headers.get('access-control-allow-origin');
  if (cors !== '*' && cors !== ORIGEN) fallos.push(`sin CORS para la app (Access-Control-Allow-Origin: ${cors ?? 'ninguno'})`);
  return fallos;
}

let mal = 0;
for (const base of BASES_OFICIALES) {
  let fallos;
  try {
    fallos = await comprobar(base);
  } catch (e) {
    fallos = [`no responde (${e.cause?.code ?? e.name}: ${e.message})`];
  }
  if (fallos.length) {
    mal++;
    console.log(`✗ ${base.nombreCorto} (${base.id})`);
    for (const f of fallos) console.log(`    ${f}`);
  } else {
    console.log(`✓ ${base.nombreCorto} (${base.id})${base.descarga ? '' : ' · solo página'}`);
  }
}
console.log(mal ? `\n${mal} base(s) con cambios: revisa el catálogo.` : '\nTodo cuadra con el catálogo.');
process.exit(mal ? 1 : 0);
