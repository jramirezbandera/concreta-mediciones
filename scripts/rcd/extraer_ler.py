"""Genera `src/core/rcd/tablas/ler.json` desde el volcado de texto (pdftotext -layout) de la
Decisión 2014/955/UE (DOUE L 370, 30-12-2014), la lista europea de residuos vigente según el
art. 6.1 de la Ley 7/2022 (verificación K-RCD.8 y K-RCD.9 de Instalaciones).

Solo guarda los capítulos que aparecen en una obra de edificación, y marca como «fuera de los
RCD» los de minería (01 04) e industria del cemento (10 13), que las plantillas y los bancos usan
por error. Añade la versión de la Decisión Delegada (UE) 2025/934 (pilas), aplicable desde el
2026-11-09 según su art. 2 (K-RCD.8): solo los cambios verificados.

Uso: python -I scripts/rcd/extraer_ler.py <volcado dec-2014-955.txt> <salida.json>
"""
import json
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')
src, out = sys.argv[1], sys.argv[2]
lines = open(src, encoding='utf-8').read().split('\n')
CODE = re.compile(r'^(\d\d \d\d(?: \d\d)?)(\*?)\s+(.*)$')
PIE = re.compile(r'^\s*(L \d+/\d+|ES|\d\d\.\d\d\.\d{4}|Diario Oficial de la Unión Europea)\s*$')

entradas, cur = [], None
for ln in lines:
    if PIE.match(ln):
        continue
    m = CODE.match(ln)
    if m:
        if cur:
            entradas.append(cur)
        cur = {'codigo': m.group(1), 'peligroso': m.group(2) == '*', 'partes': [m.group(3).strip()]}
        continue
    if cur is None:
        continue
    if not ln.strip():
        cur['cerrada'] = True
        continue
    if ln.startswith('   ') and not cur.get('cerrada'):
        cur['partes'].append(ln.strip())
    else:
        entradas.append(cur)
        cur = None
if cur:
    entradas.append(cur)


def unir(partes):
    s = ''
    for p in partes:
        s = s[:-1] + p if s.endswith('­') else (f'{s} {p}' if s else p)
    s = re.sub(r'\s*\(\d\)$', '', s.replace('­', ''))  # llamada de nota al pie: «(1)»
    return re.sub(r'\s+', ' ', s).strip()


# Capítulos que se guardan y su consideración en un estudio de RCD.
GUARDAR = [
    ('01 04', False, 'Capítulo 01 (residuos de la prospección y extracción de minerales): no son RCD.'),
    ('08 01', True, None),
    ('10 13', False, 'Capítulo 10 (fabricación de cemento, cal y yeso): no son RCD.'),
    ('13 02', True, None),
    ('14 06', True, None),
    ('15 01', True, None),
    ('15 02', True, None),
    ('16 01 07', True, None),
    ('16 06', True, None),
    ('17', True, None),
    ('20 01', True, None),
    ('20 02', True, None),
    ('20 03', True, None),
]
PAGINA = {'17': '78–79', '15': '74', '16 06': '76', '20 01': '85', '20 02': '86', '20 03': '86',
          '08 01': '60', '13 02': '72', '01 04': '49'}


def pagina(codigo):
    for pref, pag in PAGINA.items():
        if codigo.startswith(pref):
            return pag
    return None


codigos = []
for e in entradas:
    c = e['codigo']
    if len(c) != 8:
        continue  # cabeceras de capítulo y subcapítulo
    regla = next((g for g in GUARDAR if c.startswith(g[0])), None)
    if not regla:
        continue
    fila = {'codigo': c, 'descripcion': unir(e['partes']), 'peligroso': e['peligroso']}
    if not regla[1]:
        fila['rcd'] = False
        fila['aviso'] = regla[2]
    p = pagina(c)
    if p:
        fila['pagina'] = p
    codigos.append(fila)

doc = {
    'id': 'ler-2014-955',
    'norma': 'Decisión 2000/532/CE, sobre la lista de residuos, en la redacción de la Decisión 2014/955/UE',
    'fecha': '2014-12-18',
    'aplicableDesde': '2015-06-01',
    'cita': 'Lista europea de residuos (Decisión 2000/532/CE, en la redacción de la Decisión 2014/955/UE), '
            'conforme al art. 6.1 de la Ley 7/2022',
    'fuente': 'DOUE L 370, 30-12-2014, pp. 44–86 (volcado de texto del PDF)',
    'verificacion': 'K-RCD.8 y K-RCD.9 (Instalaciones/research/verificacion-residuos.md, 2026-10-16); el '
                    'resto de capítulos, transcrito del mismo volcado',
    'codigos': codigos,
    'versiones': [
        {
            'desde': '2026-11-09',
            'norma': 'Decisión Delegada (UE) 2025/934, art. 2',
            'cita': 'y la Decisión Delegada (UE) 2025/934',
            'veredicto': 'VERIFICADO (texto); 16 06 04* cotejado en imagen (K-RCD.8). La corrección de errores '
                         'que movería la fecha al 2026-12-09 está SIN CONFIRMAR.',
            'cambios': [
                {'codigo': '16 06 04', 'peligroso': True,
                 'descripcion': 'Residuos de pilas y baterías alcalinas (distintos de los especificados en el '
                                'código 16 06 03)'},
                {'codigo': '16 06 05', 'suprimido': True},
                {'codigo': '20 01 33', 'suprimido': True},
                {'codigo': '20 01 34', 'suprimido': True},
            ],
            'nota': 'El resto del nuevo subcapítulo 16 06 y los códigos 20 01 42*, 20 01 43* y 20 01 44 no se '
                    'incluyen: su correspondencia con los nombres sale del orden de lectura (SIN CONFIRMAR).',
        }
    ],
}
json.dump(doc, open(out, 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
print(len(codigos), 'códigos')
