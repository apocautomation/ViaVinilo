import type { FileCheck } from "./file-check";
import type { JobStatus } from "./job-status";

/**
 * Respuestas de la API de pedidos para el ERP. Son la forma que reciben los frontends; la API las
 * arma en `apps/api/src/jobs`.
 */

export interface SectorRef {
  code: string;
  name: string;
}

export interface MachineRef {
  id: string;
  name: string;
}

/** Material u opción de impresión con su código (D-095). */
export interface VariantRef {
  id: string;
  code: string;
  name: string;
}

/** Motivo de "Archivo con error" que se elige al devolver un pedido. */
export interface FileErrorReason {
  id: string;
  label: string;
}

/** Lo que el tablero muestra del control automático del archivo (D-065, D-071, D-077). */
export type FileCheckSummary = Pick<FileCheck, "verdict" | "detail" | "hint" | "linkNote">;

/** Una tarjeta del tablero de producción (`GET /jobs/board`). */
export interface BoardCard {
  id: string;
  label: string;
  /** D-109: "SET-000002" (código de la opción + número); sin opción, igual al VV-. */
  code: string;
  status: JobStatus;
  customer: { id: string; number: number; name: string | null };
  description: string | null;
  measure: string | null;
  quotedAmount: string | null;
  depositRequired: boolean;
  depositAmount: string | null;
  depositPaidAt: string | null;
  estimatedReadyAt: string | null;
  /** Sucursal donde retira (D-083). */
  pickupBranch: string | null;
  fileCount: number;
  fileCheck: FileCheckSummary | null;
  linkCount: number;
  machine: MachineRef | null;
  material: { id: string; name: string } | null;
  variant: VariantRef | null;
  /** Sub-servicio del pedido (D-082): Látex, Ecosolvente… */
  service: SectorRef | null;
  sameMaterialCount: number;
  createdAt: string;
  next: JobStatus | null;
  other: JobStatus[];
}

export interface BoardColumn {
  /** Distingue "Cotizado" de "Esperando seña" (D-081): las dos son del estado QUOTED. */
  key: string;
  status: JobStatus;
  label: string;
  cards: BoardCard[];
}

export interface Board {
  sector: SectorRef;
  machines: MachineRef[];
  /** Sub-servicios del tablero (D-082). */
  services: SectorRef[];
  /** Materiales de los tableros que se ven (D-095). */
  variants: VariantRef[];
  columns: BoardColumn[];
}

/** Pedido completo para el panel del tablero (`GET /jobs/:id`, D-079). */
export interface JobDetail {
  id: string;
  label: string;
  /** D-109: "SET-000002"; sin opción, igual al VV-. */
  code: string;
  status: JobStatus;
  statusLabel: string;
  sector: SectorRef;
  /** Tablero y sub-servicios entre los que se puede mover el pedido (D-082). */
  services: SectorRef[];
  variant: VariantRef | null;
  variants: VariantRef[];
  customer: { id: string; number: number; name: string | null };
  description: string | null;
  measure: string | null;
  quotedAmount: string | null;
  depositRequired: boolean;
  depositAmount: string | null;
  depositPaidAt: string | null;
  estimatedReadyAt: string | null;
  pickupBranch: string | null;
  fileCheck: FileCheckSummary | null;
  machine: MachineRef | null;
  material: { id: string; name: string } | null;
  createdAt: string;
  next: JobStatus | null;
  other: JobStatus[];
  requestedSpecs: { subject?: string; body?: string; note?: string } | null;
  externalLinks: string[];
  files: { id: string; filename: string; sizeBytes: number; purgedAt: string | null }[];
  events: {
    id: string;
    toLabel: string;
    user: string | null;
    reason: string | null;
    note: string | null;
    createdAt: string;
  }[];
}

/** Una fila de Ventas → Pedidos (`GET /jobs`). */
export interface JobListItem {
  id: string;
  label: string;
  status: JobStatus;
  statusLabel: string;
  source: string;
  description: string | null;
  measure: string | null;
  quotedAmount: string | null;
  depositRequired: boolean;
  depositPaidAt: string | null;
  estimatedReadyAt: string | null;
  createdAt: string;
  sector: SectorRef;
  customer: {
    id: string;
    customerNumber: number;
    firstName: string | null;
    lastName: string | null;
    businessName: string | null;
  } | null;
}
