import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Command,
  Compass,
  Columns2,
  ContactRound,
  CornerUpRight,
  Download,
  FileText,
  Folder,
  GripVertical,
  HardHat,
  Layers,
  LayoutGrid,
  List,
  Loader2,
  Menu,
  MoreVertical,
  Pencil,
  Plus,
  Ruler,
  Search,
  Sun,
  Moon,
  Trash2,
  Upload,
  X,
  type LucideIcon,
} from 'lucide-react';

/**
 * Registro de iconos Concreta (lucide, stroke 1.7). Sustituye el set propio
 * `ICONS` del prototipo. Las claves semánticas se conservan para que el
 * porte de las fases siguientes sea mecánico.
 */
export const ICONS = {
  chevron: ChevronRight,
  chevronDown: ChevronDown,
  upload: Upload,
  list: List,
  download: Download,
  doc: FileText,
  layers: Layers,
  search: Search,
  command: Command,
  menu: Menu,
  clipboardCheck: ClipboardCheck,
  arrowLeft: ArrowLeft,
  split: Columns2,
  grip: GripVertical,
  dots: MoreVertical,
  move: CornerUpRight,
  trash: Trash2,
  building: Building2,
  idcard: ContactRound,
  hardhat: HardHat,
  compass: Compass,
  plus: Plus,
  pencil: Pencil,
  folder: Folder,
  ruler: Ruler,
  grid: LayoutGrid,
  check: Check,
  x: X,
  sun: Sun,
  moon: Moon,
  loader: Loader2,
  alert: AlertTriangle,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export interface IconProps {
  name: IconName;
  size?: number;
  /** Stroke width; DESIGN.md fija 1.7 para el set Concreta. */
  sw?: number;
  className?: string;
  style?: React.CSSProperties;
}

/** Icono con los defaults Concreta (size 16, stroke 1.7). */
export function Icon({ name, size = 16, sw = 1.7, className, style }: IconProps) {
  const Cmp = ICONS[name];
  return <Cmp size={size} strokeWidth={sw} className={className} style={style} aria-hidden="true" />;
}
