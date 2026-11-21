import {
  BarChart3,
  BookOpenCheck,
  BookOpenText,
  Building2,
  ClipboardList,
  HandCoins,
  Landmark,
  LayoutDashboard,
  MessagesSquare,
  Package,
  Receipt,
  Scale,
  Settings,
  ShoppingCart,
  Timer,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * Menú del ERP por apartados (D-032): Ventas (lo comercial, conectado a la app de clientes),
 * Producción (los tableros de cada sector) y Administración (fiscal y finanzas, con GHM de referencia).
 * `preview: true` = pantalla solo visual con datos de ejemplo; se construye en la etapa indicada.
 */
export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Etapa del contrato en la que se construye de verdad. */
  stage?: 1 | 2 | 3 | 4;
  preview?: boolean;
  badge?: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV: NavSection[] = [
  {
    title: "General",
    items: [{ href: "/inicio", label: "Inicio", icon: LayoutDashboard }],
  },
  {
    title: "Ventas",
    items: [
      { href: "/ventas/conversaciones", label: "Conversaciones", icon: MessagesSquare, stage: 1 },
      { href: "/ventas/pedidos", label: "Pedidos", icon: ClipboardList, stage: 1 },
      { href: "/ventas/clientes", label: "Clientes", icon: Users, stage: 1 },
    ],
  },
  {
    title: "Producción",
    items: [
      // Los tableros de cada sector van en un desplegable arriba de estos ítems (D-064).
      { href: "/produccion/tableros", label: "Administrar tableros", icon: Settings, stage: 1 },
      { href: "/produccion-tiempos", label: "Panel de tiempos", icon: Timer, stage: 1 },
    ],
  },
  {
    title: "Administración",
    items: [
      { href: "/administracion/comprobantes", label: "Comprobantes ARCA", icon: Receipt, stage: 3, preview: true },
      { href: "/administracion/cobranzas", label: "Cobranzas", icon: HandCoins, stage: 3, preview: true },
      { href: "/administracion/compras", label: "Facturas de compra", icon: ShoppingCart, stage: 3, preview: true },
      { href: "/administracion/proveedores", label: "Proveedores", icon: Building2, stage: 3, preview: true },
      { href: "/administracion/bancos", label: "Bancos y caja", icon: Landmark, stage: 3, preview: true },
      { href: "/administracion/stock", label: "Stock", icon: Package, stage: 3, preview: true },
      { href: "/administracion/iva-ventas", label: "Libro IVA Ventas", icon: BookOpenText, stage: 3, preview: true },
      { href: "/administracion/iva-compras", label: "Libro IVA Compras", icon: BookOpenCheck, stage: 3, preview: true },
      { href: "/administracion/posicion-iva", label: "Posición de IVA", icon: Scale, stage: 3, preview: true },
      { href: "/administracion/reportes", label: "Reportes", icon: BarChart3, stage: 3, preview: true },
    ],
  },
  {
    title: "Sistema",
    items: [{ href: "/configuracion", label: "Configuración", icon: Settings }],
  },
];

export function findNavItem(pathname: string): NavItem | undefined {
  let best: NavItem | undefined;
  for (const s of NAV) {
    for (const i of s.items) {
      if (pathname === i.href || pathname.startsWith(`${i.href}/`)) {
        if (!best || i.href.length > best.href.length) best = i;
      }
    }
  }
  return best;
}
