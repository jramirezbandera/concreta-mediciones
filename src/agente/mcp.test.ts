/* El servidor MCP con un cliente de verdad del SDK, en memoria: initialize con la
   guía, las herramientas con su esquema y anotaciones, llamadas y errores. */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { crearServidor } from './mcp';
import { argumentosCli, cli } from './cli';

let carpeta: string;
let cliente: Client;

beforeEach(async () => {
  carpeta = mkdtempSync(join(tmpdir(), 'mediciones-mcp-'));
  const [a, b] = InMemoryTransport.createLinkedPair();
  await crearServidor('9.9.9').connect(a);
  cliente = new Client({ name: 'prueba', version: '1.0.0' });
  await cliente.connect(b);
});
afterEach(async () => {
  await cliente.close();
  rmSync(carpeta, { recursive: true, force: true });
});

/** Llama a una herramienta y devuelve su JSON (y si fue error). */
async function llamar(name: string, args: Record<string, unknown> = {}) {
  const r = await cliente.callTool({ name, arguments: args });
  const contenido = r.content as { type: string; text: string }[];
  return { json: JSON.parse(contenido[0]!.text) as Record<string, unknown>, error: !!r.isError };
}

describe('el servidor', () => {
  it('se presenta con su nombre y versión, y da la guía en las instrucciones', () => {
    expect(cliente.getServerVersion()).toMatchObject({
      name: 'concreta-mediciones',
      version: '9.9.9',
    });
    const ins = cliente.getInstructions() ?? '';
    expect(ins).toContain('Los precios no salen de tu memoria');
    expect(ins).not.toContain('name: mediciones'); // sin la cabecera de la skill
  });

  it('publica las órdenes, con lo que solo lee marcado como tal', async () => {
    const { tools } = await cliente.listTools();
    const nombres = tools.map((t) => t.name);
    expect(nombres).toEqual([
      'guia',
      'obra',
      'nueva_obra',
      'resumen',
      'arbol',
      'partida',
      'buscar',
      'validar',
      'editar',
      'seleccion',
      'abrir_app',
    ]);
    const por = Object.fromEntries(tools.map((t) => [t.name, t]));
    expect(por.resumen!.annotations?.readOnlyHint).toBe(true);
    expect(por.editar!.annotations?.readOnlyHint).toBe(false);
    expect(por.editar!.inputSchema.required).toEqual(['obra', 'operaciones']);
  });

  it('la guía también como recurso', async () => {
    const { resources } = await cliente.listResources();
    expect(resources.map((r) => r.uri)).toEqual(['mediciones://guia']);
    const r = await cliente.readResource({ uri: 'mediciones://guia' });
    expect((r.contents[0] as { text: string }).text).toContain('## Las operaciones de `editar`');
  });
});

describe('trabajar con una obra', () => {
  it('nueva_obra → editar → resumen → validar', async () => {
    const n = await llamar('nueva_obra', { carpeta, denominacion: 'Nave en el polígono' });
    expect(n.error).toBe(false);
    const e = await llamar('editar', {
      obra: carpeta,
      operaciones: [
        { op: 'crear_capitulo', titulo: 'Cimentación' },
        {
          op: 'crear_partida',
          capitulo: '1',
          titulo: 'Zapatas de HA-25',
          ud: 'm³',
          precio: 120,
          lineas: [{ comentario: 'Z1', uds: 4, largo: 2, ancho: 2, alto: 0.6 }],
        },
      ],
    });
    expect(e.error).toBe(false);
    expect(e.json).toMatchObject({
      ok: true,
      pem: 1152,
      recuento: { capitulos: 1, partidas: 1, lineas: 1 },
    });
    expect((e.json.recibos as { ref: string }[]).map((r) => r.ref)).toEqual(['1', '1.1']);
    const r = await llamar('resumen', { obra: carpeta });
    expect((r.json.importes as { pem: number }).pem).toBe(1152);
    const v = await llamar('validar', { obra: carpeta });
    expect(v.json).toMatchObject({ ok: true, errores: [], avisos: [] });
  });

  it('un fallo es un error del protocolo con su motivo, y no cambia la obra', async () => {
    await llamar('nueva_obra', { carpeta, denominacion: 'Obra' });
    const e = await llamar('editar', {
      obra: carpeta,
      operaciones: [{ op: 'set_precio', ref: '1.1', valor: 3 }],
    });
    expect(e.error).toBe(true);
    expect(e.json).toMatchObject({ ok: false, motivo: 'lote' });
    expect((await llamar('obra', { obra: 'relativa/obra' })).json).toMatchObject({
      ok: false,
      motivo: 'argumentos',
    });
    expect((await llamar('no_existe')).json).toMatchObject({ ok: false, motivo: 'orden' });
  });

  it('una carpeta sin obra, y otra con dos', async () => {
    expect((await llamar('obra', { obra: carpeta })).json).toMatchObject({
      ok: false,
      motivo: 'obra',
    });
    await llamar('nueva_obra', { carpeta, denominacion: 'Una' });
    await llamar('nueva_obra', { carpeta, denominacion: 'Otra' });
    const r = await llamar('obra', { obra: carpeta });
    expect(r.json).toMatchObject({ ok: true, varias: true });
    expect(r.json.candidatos).toHaveLength(2);
  });
});

describe('la CLI', () => {
  it('lee --clave valor como JSON si lo es, y si no como texto', () => {
    expect(
      argumentosCli([
        '--obra',
        'D:\\Obras\\X',
        '--profundidad',
        '1',
        '--partidas',
        'false',
        '--todo',
      ]),
    ).toEqual({
      obra: 'D:\\Obras\\X',
      profundidad: 1,
      partidas: false,
      todo: true,
    });
    expect(() => argumentosCli(['suelto'])).toThrow('argumento suelto');
  });

  it('la misma orden que el MCP, con código de salida', () => {
    const ok = cli(['nueva_obra', '--carpeta', carpeta, '--denominacion', 'Desde la CLI'], '1.0.0');
    expect(ok.codigo).toBe(0);
    expect(JSON.parse(ok.salida)).toMatchObject({ ok: true });
    const mal = cli(['resumen', '--obra', join(carpeta, 'nada.mediciones.json')], '1.0.0');
    expect(mal.codigo).toBe(1);
    expect(cli(['ayuda'], '1.0.0').salida).toContain('editar       --obra --operaciones');
  });
});
