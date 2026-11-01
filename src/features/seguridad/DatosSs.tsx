import type { ReactNode } from 'react';
import { art4 } from '../../core/ess/art4';
import { cotaJornadas, pideJornadas } from '../../core/ess/datos';
import type { EntradaDocumentoEss } from '../../core/ess/documento';
import {
  amiantoDe,
  estudioDe,
  jornadasMedidas,
  pemEss,
  sobreExistente,
  tiposDe,
} from '../../core/ess/obra';
import {
  ESTADOS_AMIANTO,
  NOMBRE_ESTADO_AMIANTO,
  NOMBRE_SERVICIO,
  SERVICIOS_AFECTADOS,
  type Amianto,
  type CentroAsistencial,
  type Coordinacion,
  type Entorno,
  type EstadoAmianto,
  type EstudioSsDatos,
  type ManoDeObra,
  type MediosObra,
  type ServiciosHigienicosDatos,
  type TipoObraEss,
} from '../../core/ess/tipos';
import type { Chapter, SubChapter } from '../../core/types';
import { useObraStore } from '../../store';
import { CampoNum, CampoTexto } from '../residuos/Campos';
import styles from '../residuos/Residuos.module.css';

const TIPOS: Array<[TipoObraEss, string]> = [
  ['nueva', 'Obra nueva'],
  ['reforma', 'Reforma o rehabilitación'],
  ['demolicion', 'Demolición'],
];

const euros = (v: number) =>
  `${v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const entero = (v: number) => v.toLocaleString('es-ES', { maximumFractionDigits: 0 });

/** Quita las claves `undefined` (lo guardado queda limpio). */
function limpio<T extends object>(o: T): T | undefined {
  const out = Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
  return Object.keys(out).length ? out : undefined;
}

/** Sí / No / sin declarar. */
function SiNo({
  value,
  onChange,
  si = 'Sí',
  no = 'No',
  aria,
}: {
  value: boolean | undefined;
  onChange: (v: boolean | undefined) => void;
  si?: string;
  no?: string;
  aria: string;
}) {
  return (
    <select
      className={`${styles.select} ${value === undefined ? styles.falta : ''}`}
      aria-label={aria}
      value={value === undefined ? '' : value ? 'si' : 'no'}
      onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value === 'si')}
    >
      <option value="">Sin declarar</option>
      <option value="si">{si}</option>
      <option value="no">{no}</option>
    </select>
  );
}

const Campo = ({
  label,
  children,
  full,
}: {
  label: string;
  children: ReactNode;
  full?: boolean;
}) => (
  <label className={`${styles.field} ${full ? styles.fullRow : ''}`}>
    {label}
    {children}
  </label>
);

function contenedores(chapters: Chapter[]): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const walk = (n: SubChapter, prof: number) => {
    out.push([n.id, `${'  '.repeat(prof)}${n.code} ${n.title}`]);
    for (const c of n.children ?? []) walk(c, prof + 1);
  };
  for (const ch of chapters) walk(ch, 0);
  return out;
}

/** Los datos del estudio que no salen del presupuesto. */
export function DatosSs({ e }: { e: EntradaDocumentoEss }) {
  const set = useObraStore((s) => s.setEstudioSs);
  const agentes = useObraStore((s) => s.obra.direccionFacultativa);
  const datos = useObraStore((s) => s.seguridadSalud) as EstudioSsDatos;
  const rcd = e.estudioRcd;
  const tipos = tiposDe(e);
  const existente = sobreExistente(tipos);
  const pem = pemEss(e);
  const a4 = art4(estudioDe(e));
  const medidas = jornadasMedidas(e);
  const m = datos.manoDeObra ?? {};
  const setMano = (p: Partial<ManoDeObra>) => set({ manoDeObra: limpio({ ...m, ...p }) });
  const en = datos.entorno ?? {};
  const setEntorno = (p: Partial<Entorno>) => set({ entorno: limpio({ ...en, ...p }) });
  const co = datos.coordinacion ?? {};
  const setCo = (p: Partial<Coordinacion>) => set({ coordinacion: limpio({ ...co, ...p }) });
  const me = datos.medios ?? {};
  const setMe = (p: Partial<MediosObra>) => set({ medios: limpio({ ...me, ...p }) });
  const sh = datos.serviciosHigienicos ?? {};
  const setSh = (p: Partial<ServiciosHigienicosDatos>) =>
    set({ serviciosHigienicos: limpio({ ...sh, ...p }) });
  const ca = en.centroAsistencial;
  const setCa = (p: Partial<CentroAsistencial>) => {
    const n = limpio({ nombre: '', ...ca, ...p });
    setEntorno({ centroAsistencial: n?.nombre.trim() ? n : undefined });
  };
  const am = amiantoDe(e);
  const setAm = (p: Partial<Amianto>) =>
    set({
      amianto: limpio({ estado: 'no_identificado' as EstadoAmianto, ...datos.amianto, ...p }),
    });
  const red = datos.redactor;

  return (
    <>
      <section className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardTitle}>Art. 4: ¿básico o completo?</div>
          <div className={styles.cita}>
            RD 1627/1997, art. 4.1 · Guía técnica del INSST, folios 24 y 25
          </div>
        </div>
        <div className={styles.formGrid}>
          <div className={`${styles.field} ${styles.fullRow}`}>
            Presupuesto
            <span className={styles.sub}>
              {pem.pem === undefined
                ? 'El presupuesto no tiene PEM.'
                : `PEM ${euros(pem.pem)} ${pem.origen === 'residuos' ? '(el de toda la obra, del estudio de residuos)' : '(del presupuesto'}${pem.origen === 'presupuesto' && pem.pemSs > 0 ? `, sin los ${euros(pem.pemSs)} del capítulo de seguridad y salud)` : pem.origen === 'presupuesto' ? ')' : ''}`}
              {a4.pec &&
                ` · PEC ${euros(a4.pec.pec)} con los gastos generales, el beneficio industrial y el IVA de la obra.`}
            </span>
          </div>
          <Campo label="Plazo de ejecución">
            <CampoNum
              ariaLabel="Plazo en días laborables"
              dec={0}
              min={1}
              unidad="días laborables"
              value={m.plazoDias}
              onCommit={(v) => setMano({ plazoDias: v ?? undefined })}
            />
          </Campo>
          <Campo label="Máximo de trabajadores a la vez">
            <CampoNum
              ariaLabel="Máximo de trabajadores a la vez"
              dec={0}
              min={1}
              unidad="con subcontratas y autónomos"
              value={m.maxTrabajadores}
              onCommit={(v) => setMano({ maxTrabajadores: v ?? undefined })}
            />
          </Campo>
          {pideJornadas(m) && (
            <Campo label="Volumen de mano de obra">
              <CampoNum
                ariaLabel="Jornadas de la obra"
                dec={0}
                min={0}
                unidad="jornadas"
                value={m.jornadas}
                onCommit={(v) => setMano({ jornadas: v ?? undefined })}
              />
              <span className={styles.sub}>
                Plazo × trabajadores = {entero(cotaJornadas(m)!)}, más de 500: declara las jornadas
                de la obra (Σ trabajadores × días).
                {medidas &&
                  ` Los descompuestos pagan ${entero(medidas.jornadas)} jornadas de mano de obra${medidas.pemConMo < medidas.pemTotal ? ` (solo el ${entero((medidas.pemConMo / medidas.pemTotal) * 100)} % del PEM tiene descompuesto)` : ''}.`}
              </span>
              {medidas && (
                <button
                  type="button"
                  className={`tcol ${styles.btn}`}
                  onClick={() => setMano({ jornadas: medidas.jornadas })}
                >
                  Usar {entero(medidas.jornadas)} jornadas
                </button>
              )}
            </Campo>
          )}
          <Campo label="Túneles, galerías, conducciones subterráneas o presas">
            <SiNo
              aria="Túneles, galerías, conducciones subterráneas o presas"
              value={datos.subterraneas}
              onChange={(v) => set({ subterraneas: v })}
            />
            <span className={styles.sub}>Las zanjas a cielo abierto no cuentan.</span>
          </Campo>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardTitle}>La obra</div>
        </div>
        <div className={styles.formGrid}>
          <div className={`${styles.field} ${styles.fullRow}`}>
            Tipo de obra
            {rcd ? (
              <span className={styles.sub}>
                {tipos.length
                  ? TIPOS.filter(([k]) => tipos.includes(k))
                      .map(([, l]) => l)
                      .join(', ')
                  : 'Sin declarar'}
                : se declara en el estudio de residuos.
              </span>
            ) : (
              <div className={styles.checks}>
                {TIPOS.map(([k, label]) => (
                  <label key={k} className={styles.check}>
                    <input
                      type="checkbox"
                      checked={tipos.includes(k)}
                      onChange={(ev) =>
                        set({
                          tipos: ev.target.checked ? [...tipos, k] : tipos.filter((x) => x !== k),
                        })
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
            )}
          </div>
          {existente && (
            <Campo label="Amianto (RD 396/2006, art. 10.2)">
              {rcd ? (
                <span className={styles.sub}>
                  {am ? NOMBRE_ESTADO_AMIANTO[am.estado] : 'Sin declarar'}: se declara en el estudio
                  de residuos.
                </span>
              ) : (
                <select
                  className={`${styles.select} ${datos.amianto ? '' : styles.falta}`}
                  aria-label="Amianto"
                  value={datos.amianto?.estado ?? ''}
                  onChange={(ev) =>
                    ev.target.value
                      ? setAm({ estado: ev.target.value as EstadoAmianto })
                      : set({ amianto: undefined })
                  }
                >
                  <option value="">Sin declarar</option>
                  {ESTADOS_AMIANTO.map((k) => (
                    <option key={k} value={k}>
                      {NOMBRE_ESTADO_AMIANTO[k]}
                    </option>
                  ))}
                </select>
              )}
            </Campo>
          )}
          {existente && !rcd && am && am.estado !== 'no_identificado' && (
            <Campo label="Dónde está o puede estar">
              <CampoTexto
                ariaLabel="Ubicación del amianto"
                placeholder="bajantes de fibrocemento del patio"
                value={datos.amianto?.ubicacion}
                onCommit={(v) => setAm({ ubicacion: v.trim() || undefined })}
              />
            </Campo>
          )}
          {existente && am && am.estado !== 'no_identificado' && (
            <Campo label="Tipo de material con amianto">
              <SiNo
                aria="Amianto friable"
                si="Friable (proyectado, calorifugados)"
                no="No friable (fibrocemento, vinilo)"
                value={datos.amianto?.friable}
                onChange={(v) => setAm({ friable: v })}
              />
            </Campo>
          )}
          {existente && (
            <Campo label="Edificio o local en uso durante la obra">
              <SiNo
                aria="Edificio en uso"
                value={en.edificioEnUso}
                onChange={(v) => setEntorno({ edificioEnUso: v })}
              />
            </Campo>
          )}
          <Campo label="Se ocupa la vía pública">
            <SiNo
              aria="Vía pública"
              value={en.viaPublica}
              onChange={(v) => setEntorno({ viaPublica: v })}
            />
          </Campo>
          <Campo label="Grúa torre">
            <SiNo
              aria="Grúa torre"
              si="Hay"
              no="No hay"
              value={me.gruaTorre}
              onChange={(v) => setMe({ gruaTorre: v })}
            />
          </Campo>
          <Campo label="Grúa móvil autopropulsada">
            <SiNo
              aria="Grúa móvil"
              si="Hay"
              no="No hay"
              value={me.gruaMovil}
              onChange={(v) => setMe({ gruaMovil: v })}
            />
          </Campo>
          <Campo label="Capítulo de seguridad y salud del presupuesto">
            <select
              className={styles.select}
              aria-label="Capítulo de seguridad y salud"
              value={datos.capituloSs ?? ''}
              onChange={(ev) => set({ capituloSs: ev.target.value || null })}
            >
              <option value="">Ninguno</option>
              {contenedores(e.chapters).map(([id, t]) => (
                <option key={id} value={id}>
                  {t}
                </option>
              ))}
            </select>
            <span className={styles.sub}>
              No cuenta para el PEC del art. 4 y sus partidas no proponen fichas.
            </span>
          </Campo>
          <Campo label="Planos del estudio" full>
            <CampoTexto
              ariaLabel="Planos del estudio"
              placeholder="SS01–SS02 (sin planos propios, se remite a los del proyecto)"
              value={datos.planos}
              onCommit={(v) => set({ planos: v.trim() || undefined })}
            />
          </Campo>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardTitle}>Coordinación</div>
          <div className={styles.cita}>RD 1627/1997, arts. 2.3 y 3</div>
        </div>
        <div className={styles.formGrid}>
          <Campo label="Varios proyectistas">
            <SiNo
              aria="Varios proyectistas"
              value={co.variosProyectistas}
              onChange={(v) => setCo({ variosProyectistas: v })}
            />
          </Campo>
          <Campo label="Varias empresas, o empresa y autónomos">
            <SiNo
              aria="Varias empresas"
              value={co.variasEmpresas}
              onChange={(v) => setCo({ variasEmpresas: v })}
            />
          </Campo>
          <Campo label="Cabeza de familia que contrata a autónomos (vivienda propia)">
            <SiNo
              aria="Cabeza de familia"
              value={co.cabezaFamilia}
              onChange={(v) => setCo({ cabezaFamilia: v })}
            />
          </Campo>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardTitle}>Entorno y servicios afectados</div>
        </div>
        <div className={styles.formGrid}>
          <Campo label="Centro asistencial más próximo">
            <CampoTexto
              ariaLabel="Centro asistencial"
              placeholder="falta"
              className={ca ? '' : styles.falta}
              value={ca?.nombre}
              onCommit={(v) => setCa({ nombre: v.trim() })}
            />
          </Campo>
          <Campo label="Dirección del centro">
            <CampoTexto
              ariaLabel="Dirección del centro asistencial"
              value={ca?.direccion}
              onCommit={(v) => setCa({ direccion: v.trim() || undefined })}
            />
          </Campo>
          <Campo label="Distancia">
            <CampoNum
              ariaLabel="Distancia al centro"
              placeholder="—"
              dec={1}
              min={0}
              unidad="km"
              value={ca?.distancia_km}
              onCommit={(v) => setCa({ distancia_km: v ?? undefined })}
            />
          </Campo>
          <Campo label="Tiempo de llegada">
            <CampoNum
              ariaLabel="Tiempo de llegada"
              placeholder="—"
              dec={0}
              min={0}
              unidad="min"
              value={ca?.tiempo_min}
              onCommit={(v) => setCa({ tiempo_min: v ?? undefined })}
            />
          </Campo>
          {SERVICIOS_AFECTADOS.map((s) => (
            <Campo key={s} label={NOMBRE_SERVICIO[s]}>
              <SiNo
                aria={NOMBRE_SERVICIO[s]}
                si="Existe"
                no="No existe"
                value={en.servicios?.[s]}
                onChange={(v) => setEntorno({ servicios: limpio({ ...en.servicios, [s]: v }) })}
              />
            </Campo>
          ))}
          {en.servicios?.linea_aerea === true && (
            <Campo label="Tensión de la línea aérea">
              <CampoNum
                ariaLabel="Tensión de la línea aérea"
                dec={1}
                min={0}
                unidad="kV"
                value={en.tensionLineas_kV}
                onCommit={(v) => setEntorno({ tensionLineas_kV: v ?? undefined })}
              />
            </Campo>
          )}
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardTitle}>Servicios higiénicos</div>
          <div className={styles.cita}>
            VII Convenio General del Sector de la Construcción, arts. 231 y 232
          </div>
        </div>
        <div className={styles.formGrid}>
          <Campo label="Obra de corta duración o escasa importancia">
            <SiNo
              aria="Corta duración"
              value={sh.cortaDuracion}
              onChange={(v) => setSh({ cortaDuracion: v })}
            />
          </Campo>
          {sh.cortaDuracion && (
            <Campo label="Solución alternativa">
              <CampoTexto
                ariaLabel="Solución alternativa"
                placeholder="aseo de la vivienda, cedido por el promotor"
                value={sh.alternativa}
                onCommit={(v) => setSh({ alternativa: v.trim() || undefined })}
              />
            </Campo>
          )}
          <Campo label="Hombres (opcional)">
            <CampoNum
              ariaLabel="Hombres"
              placeholder="—"
              dec={0}
              min={0}
              value={sh.hombres}
              onCommit={(v) => setSh({ hombres: v ?? undefined })}
            />
          </Campo>
          <Campo label="Mujeres (opcional)">
            <CampoNum
              ariaLabel="Mujeres"
              placeholder="—"
              dec={0}
              min={0}
              value={sh.mujeres}
              onCommit={(v) => setSh({ mujeres: v ?? undefined })}
            />
          </Campo>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardTitle}>Redacción y firma</div>
        </div>
        <div className={styles.formGrid}>
          <Campo label="Técnico que redacta">
            <CampoTexto
              ariaLabel="Nombre del técnico"
              className={red?.nombre.trim() ? '' : styles.falta}
              placeholder="falta"
              value={red?.nombre}
              onCommit={(v) =>
                set({ redactor: { titulacion: '', colegiado: '', ...red, nombre: v } })
              }
            />
          </Campo>
          <Campo label="Titulación">
            <CampoTexto
              ariaLabel="Titulación"
              placeholder="Arquitecto técnico"
              value={red?.titulacion}
              onCommit={(v) =>
                set({ redactor: { nombre: '', colegiado: '', ...red, titulacion: v } })
              }
            />
          </Campo>
          <Campo label="Nº de colegiado">
            <CampoTexto
              ariaLabel="Número de colegiado"
              value={red?.colegiado}
              onCommit={(v) =>
                set({ redactor: { nombre: '', titulacion: '', ...red, colegiado: v } })
              }
            />
          </Campo>
          {agentes && agentes.length > 0 && (
            <Campo label="De la dirección facultativa">
              <select
                className={styles.select}
                aria-label="Tomar de la dirección facultativa"
                value=""
                onChange={(ev) => {
                  const a = agentes.find((x) => x.id === ev.target.value);
                  if (a)
                    set({
                      redactor: {
                        nombre: a.nombre,
                        titulacion: red?.titulacion ?? '',
                        colegiado: a.colegiado ?? '',
                      },
                    });
                }}
              >
                <option value="">Elegir…</option>
                {agentes.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre} ({a.rol})
                  </option>
                ))}
              </select>
            </Campo>
          )}
          <Campo label="Fecha del estudio">
            <input
              type="date"
              className={styles.input}
              value={datos.fecha ?? ''}
              onChange={(ev) => set({ fecha: ev.target.value || null })}
            />
          </Campo>
        </div>
      </section>
    </>
  );
}
