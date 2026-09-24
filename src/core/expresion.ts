/* ===========================================================================
   core/expresion — operaciones sencillas en las celdas de medición
   ("5,57+3", "2×4,5", "(12-0,3)/2"). Parser propio de descenso recursivo: nada
   de `eval`/`Function`, la entrada es texto del usuario (o de un .bc3 pegado).

   Gramática (precedencia habitual, izquierda a derecha):
     expr   := term (('+' | '-') term)*
     term   := factor (('*' | '/') factor)*
     factor := ('+' | '-') factor | número | '(' expr ')'
   Multiplicar: * x X × ·    Dividir: / ÷    Restar: - −
   Un perfil o una barra vale su peso por metro («IPE 300» = 42,2 kg/m,
   «Ø12» = 0,888), así que «IPE300*1,05» suma un 5 % de uniones
   (`core/perfiles`).

   Los números siguen la regla de `parseEsNumber` token a token: con coma, la
   coma es el decimal y los puntos son miles ("1.234,5"); sin coma, UN punto es
   el decimal (lo que pega AutoCAD: "316.3978"). Así "5,57+3.2" lee 3,2 aunque
   la cadena ya tenga una coma y `toDecimalComma` haya dejado el punto.
   =========================================================================== */
import { parseEsNumber } from './money';
import { leerPerfil, nombrePerfil } from './perfiles';

type Tok = { t: 'num'; v: number } | { t: 'op'; v: '+' | '-' | '*' | '/' | '(' | ')' };

const OPS: Record<string, '+' | '-' | '*' | '/' | '(' | ')'> = {
  '+': '+',
  '-': '-',
  '−': '-',
  '*': '*',
  x: '*',
  X: '*',
  '×': '*',
  '·': '*',
  '/': '/',
  '÷': '/',
  '(': '(',
  ')': ')',
};

function numToken(s: string): number | null {
  if (s.includes(',')) return parseEsNumber(s);
  const puntos = s.split('.').length - 1;
  if (puntos === 0) return parseEsNumber(s);
  if (puntos === 1) return /^\d*\.\d*$/.test(s) && s !== '.' ? Number(s) : null;
  return parseEsNumber(s); // "1.234.567": miles
}

function tokenize(input: string): Tok[] | null {
  const out: Tok[] = [];
  let i = 0;
  while (i < input.length) {
    const c = input[i]!;
    if (/\s/.test(c)) {
      i++;
    } else if (/[\d.,]/.test(c)) {
      let j = i;
      while (j < input.length && /[\d.,]/.test(input[j]!)) j++;
      const v = numToken(input.slice(i, j));
      if (v === null) return null;
      out.push({ t: 'num', v });
      i = j;
    } else if (/[A-Za-zØø∅φΦ]/.test(c) && leerPerfil(input.slice(i))) {
      const r = leerPerfil(input.slice(i))!;
      out.push({ t: 'num', v: r.kgm });
      i += r.len;
    } else if (c in OPS) {
      out.push({ t: 'op', v: OPS[c]! });
      i++;
    } else {
      return null;
    }
  }
  return out;
}

/**
 * Evalúa una operación escrita en formato español. Devuelve `null` si no es
 * válida (sintaxis, división por cero, resultado no finito). El resultado se
 * redondea a 6 decimales para no arrastrar ruido de coma flotante (0,1+0,2).
 */
export function evalEsExpr(input: string): number | null {
  const tokens = tokenize(input);
  if (!tokens || tokens.length === 0) return null;
  const toks: Tok[] = tokens;
  let pos = 0;
  const peek = () => toks[pos];
  const isOp = (v: string) => {
    const t = peek();
    return t?.t === 'op' && t.v === v;
  };

  function expr(): number | null {
    let a = term();
    while (a !== null && (isOp('+') || isOp('-'))) {
      const op = (toks[pos++] as { v: string }).v;
      const b = term();
      if (b === null) return null;
      a = op === '+' ? a + b : a - b;
    }
    return a;
  }
  function term(): number | null {
    let a = factor();
    while (a !== null && (isOp('*') || isOp('/'))) {
      const op = (toks[pos++] as { v: string }).v;
      const b = factor();
      if (b === null) return null;
      if (op === '/' && b === 0) return null;
      a = op === '*' ? a * b : a / b;
    }
    return a;
  }
  function factor(): number | null {
    const t = peek();
    if (!t) return null;
    if (t.t === 'num') {
      pos++;
      return t.v;
    }
    if (t.v === '+' || t.v === '-') {
      pos++;
      const f = factor();
      return f === null ? null : t.v === '-' ? -f : f;
    }
    if (t.v === '(') {
      pos++;
      const e = expr();
      if (e === null || !isOp(')')) return null;
      pos++;
      return e;
    }
    return null;
  }

  const r = expr();
  if (r === null || pos !== toks.length || !Number.isFinite(r)) return null;
  return Math.round(r * 1e6) / 1e6 || 0; // `|| 0`: sin "-0"
}

/**
 * Lee lo tecleado en una celda de medición: un número suelto (tal cual, con
 * `parseEsNumber`), un perfil o una operación. `expr` solo viene si NO era un
 * número suelto —es lo que merece guardarse para ver luego de dónde sale el
 * número—; un perfil solo se guarda con su nombre canónico ("ipe300" → "IPE 300").
 */
export function leerCelda(input: string): { value: number; expr?: string } | null {
  const s = input.trim();
  const n = parseEsNumber(s);
  if (n !== null) return { value: n };
  const perfil = nombrePerfil(s);
  if (perfil) return { value: leerPerfil(perfil)!.kgm, expr: perfil };
  const v = evalEsExpr(s);
  return v === null ? null : { value: v, expr: s };
}
