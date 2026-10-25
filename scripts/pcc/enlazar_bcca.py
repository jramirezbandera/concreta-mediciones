"""Escribe `src/core/pcc/tablas/enlace-bcca.json`: cada ensayo del catálogo de la Junta con su
partida (o partidas) del capítulo 18 de la BCCA 2023, o sin código, y lo que cubre ese precio
(docs/plan-control-calidad.md, §3 y §8; O4).

El enlace se cura a mano en `enlace_bcca.json` (D-ejemplos.md §4.2: los precios no se casan por
importe). Este script no decide nada: lee la BCCA (que no se versiona) y comprueba la tabla curada
contra ella y contra el catálogo:

  - cada ensayo del catálogo está una sola vez;
  - cada código existe en el capítulo 18;
  - sin código, con varias partidas o con un precio distinto del de la hoja (±0,5 %), hay `motivo`;
  - el texto (`~T`) de cada partida se pasa por la lista de citas vetadas y las frases que se
    quitan de `correcciones_junta.json`, y lo que salga se guarda en `citasVetadas` (K-PCC.68), para que
    «Crear capítulo» no lo copie sin filtrar.

Del banco se guarda código, resumen y unidad, no el precio: el precio se copia del banco cargado
con «Tomar precios de un banco» (§8, A1).

Uso: python -I scripts/pcc/enlazar_bcca.py <BCCA2023_V02.bc3> <catalogo.json> <enlace_bcca.json>
     <correcciones_junta.json> <salida.json>
Cualquier fila que no encaje sale por pantalla y aborta.
"""
import json
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')
fbc3, fcat, fcur, fcorr, out = sys.argv[1:6]
problemas = []
BS = chr(92)

# ---- BCCA: partidas del capítulo 18 --------------------------------------------------------
raw = open(fbc3, 'rb').read().decode('cp1252')
conceptos, textos, hijos, capitulos = {}, {}, {}, set()
for reg in raw.split('~')[1:]:
    f = reg.split('|')
    if f[0] == 'C':
        for cod in f[1].split(BS):
            if cod.endswith('#'):
                capitulos.add(cod.rstrip('#'))
            conceptos[cod.rstrip('#')] = {'ud': f[2].strip(), 'resumen': f[3].strip(), 'precio': float(f[4] or 0)}
    elif f[0] == 'T':
        textos[f[1]] = re.sub(r'\s+', ' ', f[2]).strip()
    elif f[0] == 'D':
        hijos[f[1].rstrip('#')] = [h for h in f[2].split(BS)[0::3] if h]

partidas = {}


def recorre(cap):
    for h in hijos.get(cap, []):
        if h in capitulos:
            recorre(h)
        else:
            partidas[h] = conceptos[h]


recorre('18')
if len(partidas) < 300:
    sys.exit(f'{fbc3}: el capítulo 18 tiene {len(partidas)} partidas; ¿es la BCCA 2023?')

# ---- tabla curada contra el catálogo -------------------------------------------------------
catalogo = json.load(open(fcat, encoding='utf-8'))
ensayos = catalogo['ensayos']
curado = json.load(open(fcur, encoding='utf-8'))
corr = json.load(open(fcorr, encoding='utf-8'))
VETO = re.compile('|'.join([corr['veto']] + [q['patron'] for q in corr['quitarDeObs']]), re.I)

decision = {}
for g in curado['enlaces']:
    for i in g['ids']:
        if i in decision:
            problemas.append(f'{i}: está dos veces en la tabla curada')
        decision[i] = g
for i in set(decision) - {e['id'] for e in ensayos}:
    problemas.append(f'{i}: no existe en el catálogo')

enlaces = []
for e in ensayos:
    g = decision.get(e['id'])
    if g is None:
        problemas.append(f'{e["id"]}: sin decidir ({e["ensayo"][:50]!r})')
        continue
    motivo = g.get('motivo')
    fila = {'ensayo': e['id'], 'partidas': [], 'unidad': e['unidad']}
    for cod in g['codigos']:
        p = partidas.get(cod)
        if p is None:
            problemas.append(f'{e["id"]}: {cod} no es una partida del capítulo 18')
            continue
        fila['partidas'].append({'codigo': cod, 'resumen': p['resumen'], 'ud': p['ud']})
        vetadas = sorted({m.group(0).strip(' *.') for t in (p['resumen'], textos.get(cod, ''))
                          for m in VETO.finditer(t)})
        if vetadas:
            fila.setdefault('citasVetadas', []).extend(f'{cod}: {v}' for v in vetadas)
    if not g['codigos']:
        fila['como'] = 'sinCodigo'
    elif len(g['codigos']) > 1:
        fila['como'] = 'compuesto'
    else:
        fila['como'] = 'partida'
    precio = sum(partidas[c]['precio'] for c in g['codigos'] if c in partidas)
    igual = bool(g['codigos']) and e['precio'] is not None and abs(precio - e['precio']) <= 0.005 * e['precio']
    if g['codigos']:
        fila['precioComoLaHoja'] = igual
    if not motivo and (fila['como'] != 'partida' or not igual):
        problemas.append(f'{e["id"]} → {g["codigos"]}: falta `motivo` ({fila["como"]}, BCCA {precio:.2f} €'
                         f' frente a {e["precio"]} € de la hoja)')
    if motivo:
        fila['motivo'] = motivo
    if g.get('cubre'):
        if not g['codigos']:
            problemas.append(f'{e["id"]}: `cubre` sin partida')
        fila['cubre'] = g['cubre']
    enlaces.append(fila)

if problemas:
    print('\n'.join(problemas))
    sys.exit(1)

cuenta = {}
for f in enlaces:
    cuenta[f['como']] = cuenta.get(f['como'], 0) + 1
salida = {
    'id': 'enlace-bcca',
    'norma': 'Base de Costes de la Construcción de Andalucía (BCCA), capítulo 18 «Control de calidad, '
             'pruebas y ensayos». Junta de Andalucía',
    'edicion': 'BCCA 2023, V02 (FIEBDC-3/2020)',
    'version': 'bcca-2023-V02',
    'catalogo': catalogo['version'],
    'verificacion': 'docs/research/control-calidad/D-ejemplos.md §4.2; K-PCC.60, K-PCC.67, K-PCC.68',
    'veredicto': 'CURADO A MANO',
    'reglas': {
        'como': 'partida: una partida de la BCCA; compuesto: el precio de la hoja es la suma de varias '
                'partidas; sinCodigo: la BCCA no tiene el ensayo (o lo tiene con un precio que no se sabe '
                'qué cubre) y queda el precio de la hoja o el que se teclee.',
        'unidad': 'En qué se mide el precio, la misma que la fila del catálogo (K-PCC.60). La `ud` de '
                  'cada partida es la que escribe la BCCA, que a veces pone m² o m³ (el tamaño del lote) '
                  'en ensayos que se pagan por ensayo: manda `unidad`.',
        'cubre': 'Solo cuando el texto de la BCCA dice algo distinto de la hoja o lo añade; si falta, el '
                 'precio de la BCCA cubre lo mismo que dice el `cubre` del catálogo. `porEnsayo`: '
                 'precios que hacen falta por cada ensayo.',
        'precioComoLaHoja': 'El precio de la BCCA 2023 es el de la hoja (±0,5 %); si no, `motivo` lo dice.',
        'citasVetadas': 'Citas derogadas o sustituidas en el texto de la partida (K-PCC.68): «Crear '
                        'capítulo» no copia ese texto sin filtrar.',
    },
    'cuenta': cuenta,
    'enlaces': enlaces,
}
with open(out, 'w', encoding='utf-8', newline='\n') as fo:
    json.dump(salida, fo, ensure_ascii=False, indent=1)
    fo.write('\n')
usados = {p['codigo'] for f in enlaces for p in f['partidas']}
print(f'{len(enlaces)} ensayos;', ', '.join(f'{k} {v}' for k, v in sorted(cuenta.items())),
      f'; {sum(1 for f in enlaces if f.get("precioComoLaHoja") is False)} con otro precio;'
      f' {len(usados)} de {len(partidas)} partidas del cap. 18 usadas;'
      f' {sum(1 for f in enlaces if "citasVetadas" in f)} con citas vetadas en el texto')
