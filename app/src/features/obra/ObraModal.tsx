import { Icon, type IconName } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { useObraStore } from '../../store';
import { ProjectBackup } from './ProjectBackup';
import styles from './ObraModal.module.css';

/** [ruta, etiqueta, ancho completo en grid]. Ruta anidada → `setObraPath`. */
type FieldDef = [path: string, label: string, full?: boolean];
type Section = [title: string, icon: IconName, fields: FieldDef[]];

/** Mapa de campos del prototipo (`app.jsx:146-151`). Las rutas con `.` son anidadas. */
const SECTIONS: Section[] = [
  [
    'Obra',
    'building',
    [
      ['denominacion', 'Denominación', true],
      ['direccion', 'Emplazamiento', true],
      ['localidad', 'Localidad'],
      ['provincia', 'Provincia'],
      ['refCatastral', 'Ref. catastral'],
      ['expediente', 'Expediente nº'],
    ],
  ],
  [
    'Promotor (Propiedad)',
    'idcard',
    [
      ['promotor.nombre', 'Nombre / razón social', true],
      ['promotor.nif', 'NIF / CIF'],
      ['promotor.telefono', 'Teléfono'],
      ['promotor.email', 'Email'],
      ['promotor.direccion', 'Dirección', true],
    ],
  ],
  [
    'Empresa constructora',
    'hardhat',
    [
      ['constructor.nombre', 'Empresa', true],
      ['constructor.cif', 'CIF'],
      ['constructor.jefe', 'Jefe de obra'],
      ['constructor.telefono', 'Teléfono'],
      ['constructor.direccion', 'Dirección', true],
    ],
  ],
  [
    'Dirección facultativa',
    'compass',
    [
      ['redactor.nombre', 'Técnico redactor'],
      ['redactor.colegiado', 'Nº colegiado'],
      ['lugar', 'Lugar de firma'],
      ['fecha', 'Fecha del documento'],
    ],
  ],
];

/** Lee una ruta anidada de la obra; devuelve '' si no es un string presente. */
function getPath(obj: unknown, path: string): string {
  const v = path
    .split('.')
    .reduce<unknown>(
      (o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined),
      obj,
    );
  return typeof v === 'string' ? v : '';
}

export interface ObraModalProps {
  open: boolean;
  onClose: () => void;
  compact?: boolean;
}

/**
 * Modal "Datos de la obra" (F6.2): edita denominación/promotor/constructora/
 * dirección facultativa. Personalizan los documentos exportados (F7). Escribe por
 * ruta anidada con `setObraPath`; el breadcrumb del TopBar lee `obra.denominacion`.
 */
export function ObraModal({ open, onClose, compact }: ObraModalProps) {
  const obra = useObraStore((s) => s.obra);
  const setObraPath = useObraStore((s) => s.setObraPath);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Datos de la obra"
      subtitle="Personalizan los documentos exportados"
      icon="building"
      compact={compact}
      footer={
        <button type="button" onClick={onClose} className={`t150 ${styles.done}`}>
          Hecho
        </button>
      }
    >
      {SECTIONS.map(([title, icon, fields]) => (
        <section key={title} className={styles.section}>
          <div className={styles.secHead}>
            <Icon name={icon} size={15} />
            <span className="sec-head">{title}</span>
          </div>
          <div className={`${styles.grid} ${compact ? styles.one : ''}`}>
            {fields.map(([path, label, full]) => (
              <label
                key={path}
                className={`${styles.field} ${full && !compact ? styles.full : ''}`}
              >
                <span className={`caps ${styles.fLabel}`}>{label}</span>
                <input
                  className={styles.input}
                  value={getPath(obra, path)}
                  onChange={(e) => setObraPath(path, e.target.value)}
                />
              </label>
            ))}
          </div>
        </section>
      ))}
      <ProjectBackup onImported={onClose} />
    </Modal>
  );
}
