"""Extrae el catálogo de ensayos de la hoja «Plan de Control de Calidad de Materiales para Obras
de Edificación (versión Código Estructural)» de la Junta de Andalucía, V04 de enero de 2023
(PlanCC_CodE_V04_2023.xls), a `src/core/pcc/tablas/catalogo.json`.

La hoja es de uso libre (docs/plan-control-calidad.md, D1) pero no se versiona: se pasa su ruta.
Se usa como catálogo de ensayos (nombre, norma, nº por lote, tamaño y tipo de lote, nivel, código
DR y precio de referencia de 2022), NO como algoritmo: los lotes del hormigón los calcula la app
con el Código Estructural (docs/research/control-calidad/D-ejemplos.md §3.3).

Lee los VALORES de las hojas de capítulo (02 a 13; la 15, urbanización, queda fuera de alcance)
y aplica después `correcciones_junta.json`, donde va cada corrección con la fila original y el
motivo (plan, §3 bis), y los datos de la hoja que solo están en sus fórmulas.

Tipos de lote (D-ejemplos.md §3.2):
  A por medición · B porcentaje de unidades · C uno por instalación o edificio · D por tipo de
  producto · E por procedencia · F por día o mes de trabajo · G del cálculo de amasadas (lo hace
  la app) · H a juicio de la DF · I exigencia documental sin cuantía.

Uso: python -I scripts/pcc/extraer_junta.py <PlanCC_CodE_V04_2023.xls> <correcciones.json> <salida.json>
Cualquier fila que no encaje con lo esperado sale por pantalla y aborta.
"""
import json
import re
import sys

import xlrd

sys.stdout.reconfigure(encoding='utf-8')
src, fcorr, out = sys.argv[1], sys.argv[2], sys.argv[3]
problemas = []

HOJAS = ['02', '03', '06', '07', '08', '09', '10', '11', '13']
AUX = '03_C_y_E_AUX_CALC AMASADAS'
UD_OBRA = re.compile(r'^(m|m²|m2|m³|m3|t|tubo|pilote|nº pilotes|anclaje|ud|500 m o fracción)$', re.I)


def txt(v):
    return re.sub(r'\s+', ' ', str(v)).strip()


def num(v):
    if isinstance(v, (int, float)):
        return float(v)
    try:
        return float(txt(v).replace(',', '.'))
    except ValueError:
        return None


def tipo_lote(lote, ud):
    """Tipo de lote de la fila, por los valores de las columnas «tamaño de lote» y «Ud»."""
    ll = lote.lower()
    if AUX in lote or AUX in ud or ll.startswith('control '):
        return 'G'
    if lote == '*':
        return 'H'
    if lote in ('-', ''):
        return 'I'
    if re.search(r'd[ií]a|\bmes\b|diagraf', ll):
        return 'F'
    if re.search(r'procedencia|fracci', ll) and 'tipo' not in ll:
        return 'E'
    if re.search(r'tipo|tipolog|anclajes', ll):
        return 'D'
    if ll in ('ud', 'por recinto instalación'):
        # «Ud» de edificio, transformador, red o recinto: la hoja multiplica el nº que se teclea.
        return 'C'
    if re.search(r'pilote', ll):
        return 'A'
    v = num(lote)
    if v is None:
        return None
    if v < 1:
        return 'B'
    if v == 1 and not UD_OBRA.match(ud):
        return 'C'
    return 'A'


b = xlrd.open_workbook(src)
ensayos = []
for sh in b.sheets():
    hoja = sh.name[:2]
    if hoja not in HOJAS or 'AUX' in sh.name:
        continue
    cab = [txt(sh.cell_value(0, c)) for c in range(sh.ncols)]
    if 'NORMA O PROCEDIMIENTO' not in cab:
        problemas.append(f'{sh.name}: sin columna «NORMA O PROCEDIMIENTO»')
        continue
    cn = cab.index('NORMA O PROCEDIMIENTO')
    c_n, c_lote, c_ud, c_pre, c_obs = cn + 1, cn + 2, cn + 3, cn + 6, cn + 8
    capitulo = ''
    apartado = []
    previo = None
    for r in range(3, sh.nrows):
        def v(c):
            return sh.cell_value(r, c) if c < sh.ncols else ''
        a, nombre = txt(v(0)), txt(v(2))
        if a.startswith('CAPÍTULO'):
            capitulo = capitulo or re.sub(r'^CAPÍTULO\s*:\s*', '', a)
            continue
        nivel = num(a)
        if nivel is None:
            m = re.match(r'^(\d+(?:\.\d+)*)\.?\s+(.*)$', nombre)
            if m:
                prof = m.group(1).count('.')
                apartado = [p for p in apartado if p[0] < prof] + [(prof, m.group(1), m.group(2))]
                continue
            if nombre and previo and num(v(c_pre)) is not None:
                # Fila sin nivel con precio: alternativa de la anterior (líquidos penetrantes o
                # partículas magnéticas…). Toma su nivel y su lote; la corrección dice qué es.
                nivel = previo['nivel']
            else:
                continue
        fila = r + 1
        nombre = nombre or (previo['ensayo'] if previo else '')
        lote, ud = txt(v(c_lote)), txt(v(c_ud))
        alternativa = not lote and previo is not None and not txt(v(c_n))
        if alternativa:
            lote, ud = previo['loteHoja']['tamano'], previo['loteHoja']['ud']
            tl, n = previo['lote']['tipo'], previo['lote']['n']
        else:
            tl, n = tipo_lote(lote, ud), num(v(c_n))
        if tl is None:
            problemas.append(f'{sh.name} fila {fila}: tamaño de lote no reconocido {lote!r} / {ud!r}')
        e = {
            'id': f'j{hoja}-{fila:03d}',
            'capitulo': hoja,
            'apartado': ' · '.join(f'{p[1]} {p[2]}' for p in apartado),
            'nivel': int(nivel),
            'dr': txt(v(1)) if txt(v(1)) not in ('', '-') else None,
            'ensayo': nombre,
            'norma': txt(v(cn)) or None,
            'lote': {'tipo': tl, 'n': n},
            'loteHoja': {'tamano': lote, 'ud': ud},
            'precio': num(v(c_pre)),
            # En qué se mide el precio (K-PCC.60): las inspecciones se pagan por visita de
            # ½ jornada o jornada; lo demás, por ensayo, salvo lo que diga `cubre` en las
            # correcciones (por amasada, por metro).
            'unidad': 'visita' if re.search(r'jornada|visita de t[eé]cnico', nombre, re.I) else 'ensayo',
            'obs': txt(v(c_obs)) or None,
        }
        if alternativa:
            e['alternativaDe'] = previo.get('alternativaDe', previo['id'])
        t = num(lote)
        if tl in ('A', 'B', 'C') and t is not None:
            e['lote']['tamano'] = t
            e['lote']['ud'] = ud
        elif tl == 'C':
            e['lote']['tamano'] = 1.0
            e['lote']['ud'] = ud
        if e['precio'] is None and tl != 'I':
            problemas.append(f'{sh.name} fila {fila}: sin precio')
        ensayos.append(e)
        previo = e

# ---- correcciones (§3 bis) y datos que solo están en las fórmulas --------------------------
corr = json.load(open(fcorr, encoding='utf-8'))
por_id = {e['id']: e for e in ensayos}


def filas(c):
    for i in c['ids']:
        e = por_id.get(i)
        if e is None:
            problemas.append(f'{c.get("motivo", c.get("fuente", ""))[:40]!r}: no existe la fila {i}')
        else:
            yield e


def cambia(e, campos):
    for k, val in campos.items():
        if k == 'lote':
            e['lote'].update(val)
        else:
            e[k] = val


# Datos de la hoja que están en sus fórmulas o en la hoja auxiliar, no en las celdas: no son
# correcciones y no dejan rastro en la fila.
for c in corr['anotaciones']:
    for e in filas(c):
        cambia(e, c['cambia'])

# Correcciones: cada una guarda en la fila lo que decía la hoja, el motivo y la cita.
for c in corr['filas']:
    for e in filas(c):
        original = {k: (dict(e['lote']) if k == 'lote' else e.get(k)) for k in c['cambia']}
        cambia(e, c['cambia'])
        e.setdefault('correcciones', []).append(
            {'original': original, 'motivo': c['motivo'], 'cita': c['cita']})

# Frases que se quitan de las observaciones allí donde salgan.
for q in corr['quitarDeObs']:
    patron = re.compile(q['patron'], re.I)
    for e in ensayos:
        if e['obs'] and patron.search(e['obs']):
            original = e['obs']
            e['obs'] = re.sub(r'\s+', ' ', patron.sub('', e['obs'])).strip(' .') or None
            e.setdefault('correcciones', []).append(
                {'original': {'obs': original}, 'motivo': q['motivo'], 'cita': q['cita']})

# Lo que cubre el precio de la hoja (O4) y en qué se mide, cuando la hoja lo dice en el nombre, en
# la observación o en sus fórmulas. No son correcciones: van con `segun`, de dónde sale. Varias
# entradas sobre la misma fila se suman.
for c in corr['cubre']:
    for e in filas(c):
        cubre = {**e.get('cubre', {}), **c['cubre']}
        cubre['segun'] = '; '.join(filter(None, [e.get('cubre', {}).get('segun'), c['segun']]))
        e['cubre'] = cubre
        if 'unidad' in c:
            e['unidad'] = c['unidad']

# Normas de ensayo sustituidas (K-PCC.51) y citas derogadas (K-PCC.50) que no tienen corrección:
# abortan, para que ninguna llegue al JSON sin decidir qué se hace con ella.
VETO = re.compile(corr['veto'], re.I)
for e in ensayos:
    for k, t in (('ensayo', e['ensayo']), ('norma', e['norma']), ('obs', e['obs']),
                 ('cubre', (e.get('cubre') or {}).get('nota'))):
        if t and VETO.search(t):
            problemas.append(f'{e["id"]} {k}: cita vetada sin corregir: {VETO.search(t).group(0)!r}'
                             f' en {t[:80]!r}')

for e in ensayos:
    if e['lote']['tipo'] == 'G' and not e['lote'].get('calculo'):
        problemas.append(f'{e["id"]}: lote del cálculo de la app sin `calculo` ({e["ensayo"][:50]!r})')

if problemas:
    print('\n'.join(problemas))
    sys.exit(1)

for e in ensayos:
    del e['loteHoja']
salida = {
    'id': 'catalogo',
    'norma': 'Plan de Control de Calidad de Materiales para Obras de Edificación (versión Código '
             'Estructural). Junta de Andalucía, Consejería de Fomento, ALA y ETSIE de Sevilla',
    'edicion': 'V04, enero de 2023',
    'version': 'junta-PCC-V04-2023',
    'verificacion': 'K-PCC.38-39; docs/research/control-calidad/D-ejemplos.md §3',
    'veredicto': 'CORREGIDO',
    'precios': {'fecha': '2022', 'origen': 'Precios unitarios recomendados de la hoja (AOPJA y mercado)'},
    'fueraDeAlcance': 'Capítulo 15 (urbanización): fuera de esta versión; repite el 02 en 15.1-15.7.',
    'tiposDeLote': {
        'A': 'por medición', 'B': 'porcentaje de unidades', 'C': 'uno por instalación o edificio',
        'D': 'por tipo de producto', 'E': 'por procedencia', 'F': 'por día o mes de trabajo',
        'G': 'lo calcula la app con el Código Estructural (`calculo` dice qué cuenta)',
        'H': 'a juicio de la DF', 'I': 'exigencia documental sin cuantía',
    },
    'ensayos': ensayos,
}
with open(out, 'w', encoding='utf-8', newline='\n') as f:
    json.dump(salida, f, ensure_ascii=False, indent=1)
    f.write('\n')
cuenta = {}
for e in ensayos:
    cuenta[e['lote']['tipo']] = cuenta.get(e['lote']['tipo'], 0) + 1
print(f'{len(ensayos)} ensayos;', ', '.join(f'{k} {v}' for k, v in sorted(cuenta.items())),
      f'; {sum(1 for e in ensayos if "correcciones" in e)} corregidos')
