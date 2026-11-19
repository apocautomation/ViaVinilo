/**
 * Datos de ejemplo de la app de clientes (D-034): pantallas solo visuales hasta conectar la API.
 * Los estados y su orden salen de la actualización §2.4 y de D-013 (seña).
 */
export type Status = "RECEIVED" | "FILE_ERROR" | "QUOTED" | "DEPOSIT_RECEIVED" | "PRINTED" | "CALENDERING" | "READY" | "DELIVERED";

/** Cómo ve el cliente cada estado. "Impreso", nunca "Imprimiendo" (actualización §2.4). */
export const STATUS_LABEL: Record<Status, string> = {
  RECEIVED: "Archivo recibido",
  FILE_ERROR: "Archivo con error",
  QUOTED: "Cotizado",
  DEPOSIT_RECEIVED: "Seña recibida",
  PRINTED: "Impreso",
  CALENDERING: "En calandra",
  READY: "Listo para retirar",
  DELIVERED: "Entregado",
};

export const STATUS_CLASS: Record<Status, string> = {
  RECEIVED: "st-received",
  FILE_ERROR: "st-error",
  QUOTED: "st-quoted",
  DEPOSIT_RECEIVED: "st-quoted",
  PRINTED: "st-printed",
  CALENDERING: "st-printed",
  READY: "st-ready",
  DELIVERED: "",
};

export interface Order {
  id: string;
  num: string;
  sector: string;
  desc: string;
  measure: string;
  status: Status;
  steps: Status[];
  amount?: number;
  deposit?: number;
  readyAt?: string;
  error?: string;
  files: { name: string; size: string }[];
  history: { status: Status; at: string }[];
  channel: "App" | "Mail";
}

const DTF: Status[] = ["RECEIVED", "QUOTED", "PRINTED", "READY", "DELIVERED"];
const SUBLI: Status[] = ["RECEIVED", "QUOTED", "DEPOSIT_RECEIVED", "PRINTED", "CALENDERING", "READY", "DELIVERED"];

export const ORDERS: Order[] = [
  {
    id: "418",
    num: "VV-000418",
    sector: "DTF",
    desc: "Frente remeras escuela",
    measure: "58 cm × 3 m",
    status: "READY",
    steps: DTF,
    amount: 54000,
    readyAt: "Hoy 13:00",
    files: [{ name: "frente-escuela.pdf", size: "4,2 MB" }],
    history: [
      { status: "RECEIVED", at: "Hoy 09:15" },
      { status: "QUOTED", at: "Hoy 09:32" },
      { status: "PRINTED", at: "Hoy 11:48" },
      { status: "READY", at: "Hoy 12:20" },
    ],
    channel: "App",
  },
  {
    id: "415",
    num: "VV-000415",
    sector: "Sublimación",
    desc: "Tela sublimada",
    measure: "1,60 m × 3 m",
    status: "FILE_ERROR",
    steps: SUBLI,
    error: "La resolución del archivo es menor a 150 dpi. Reenvialo en mejor calidad.",
    files: [{ name: "tela.tif", size: "12 MB" }],
    history: [
      { status: "RECEIVED", at: "Hoy 09:40" },
      { status: "FILE_ERROR", at: "Hoy 09:58" },
    ],
    channel: "Mail",
  },
  {
    id: "421",
    num: "VV-000421",
    sector: "DTF",
    desc: "Logos para gorras",
    measure: "58 cm × 1,2 m",
    status: "QUOTED",
    steps: DTF,
    amount: 21600,
    readyAt: "Hoy 17:00",
    files: [{ name: "logos.png", size: "2,1 MB" }],
    history: [
      { status: "RECEIVED", at: "Hoy 10:05" },
      { status: "QUOTED", at: "Hoy 10:22" },
    ],
    channel: "App",
  },
  {
    id: "411",
    num: "VV-000411",
    sector: "Sublimación",
    desc: "Tazas personalizadas · 40 u.",
    measure: "40 unidades",
    status: "CALENDERING",
    steps: SUBLI,
    amount: 120000,
    deposit: 60000,
    readyAt: "Mañana 10:00",
    files: [{ name: "tazas.pdf", size: "8,4 MB" }],
    history: [
      { status: "RECEIVED", at: "Ayer 16:10" },
      { status: "QUOTED", at: "Ayer 16:40" },
      { status: "DEPOSIT_RECEIVED", at: "Ayer 17:05" },
      { status: "PRINTED", at: "Hoy 10:30" },
      { status: "CALENDERING", at: "Hoy 11:15" },
    ],
    channel: "App",
  },
  {
    id: "396",
    num: "VV-000396",
    sector: "DTF UV",
    desc: "Stickers · 200 u.",
    measure: "200 unidades",
    status: "DELIVERED",
    steps: DTF,
    amount: 46500,
    files: [{ name: "stickers.ai", size: "3,3 MB" }],
    history: [
      { status: "RECEIVED", at: "17/11 09:00" },
      { status: "QUOTED", at: "17/11 09:20" },
      { status: "PRINTED", at: "17/11 14:10" },
      { status: "READY", at: "17/11 15:00" },
      { status: "DELIVERED", at: "18/11 10:30" },
    ],
    channel: "Mail",
  },
];


export const ars = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 });
