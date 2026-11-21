import { help, normalizeSearch } from "@viavinilo/contracts";
import type { BotJob } from "./prompt";

/**
 * Flujos fijos del bot, sin IA (D-060). Son los pasos del pedido que no pueden fallar: el modelo
 * local es chico y llegó a inventar "el archivo se recibió". La IA queda para el resto de las
 * preguntas (cómo preparar el archivo, horarios, pagos…).
 */

export interface FlowContext {
  firstName: string | null;
  alreadyTalking: boolean;
  noticesOn: boolean;
  jobs: BotJob[];
  /** Tableros creados desde el ERP (D-064), además de los servicios de base. */
  boards?: ExtraBoard[];
}

export interface ExtraBoard {
  name: string;
  email: string | null;
}

/** Si el cliente nombra un tablero creado desde el ERP ("TPU"), se usa ese. */
export function boardFor(text: string, boards: ExtraBoard[] = []): ExtraBoard | null {
  const t = ` ${normalizeSearch(text).replace(/[^a-z0-9]+/g, " ")} `;
  return boards.find((b) => t.includes(` ${normalizeSearch(b.name).replace(/[^a-z0-9]+/g, " ").trim()} `)) ?? null;
}

const HOW_TO_SEND = (email: string | null) =>
  email ? `Mandá el archivo con el clip 📎 de este chat o por mail a ${email}` : "Mandá el archivo con el clip 📎 de este chat";

const GREETING = /^\s*(hola+|buenas?( tardes| noches| d[ií]as)?|buen d[ií]a|holis|qu[eé] tal)[\s!.,¿?]*$/i;
const STATUS = /\b(est[aá] listo|ya est[aá]|cu[aá]ndo (est[aá]|va a estar|lo retiro|retiro)|estado de mi|mi pedido|c[oó]mo va|lo puedo retirar)\b/i;
/** Un trabajo nuevo: pide imprimir, manda medidas o un archivo, o avisa que adjunta (D-060, D-061). */
const NEW_JOB =
  /\b(imprimir|impresi[oó]n|quiero (hacer|mandar|imprimir)|te paso|necesito|adjunto|adjunta|ah[ií] va|te mando|les? (env[ií]o|mando|paso)|env[ií]o (el|un|los|unos|este)? ?archivos?|archivos? para)\b|\d+([.,]\d+)?\s*(m|cm|mts?)?\s*[x×]\s*\d|\.(png|jpe?g|pdf|tiff?|eps|ai|cdr|psd)\b/i;

/** Horarios y formatos se responden solo si el cliente pregunta (D-061): "lo retiro en la sucursal" es un dato, no una pregunta. */
const ASKS = /\?|^\s*(d[oó]nde|qu[eé]|cu[aá]l|cu[aá]ndo|a qu[eé] hora|hasta qu[eé] hora|c[oó]mo|puedo|se puede|tienen|hay)\b/i;
const HOURS = /\b(horarios?|d[oó]nde (queda|est[aá]n|es)|direcci[oó]n|sucursal(es)?|abren|cierran|atienden)\b/i;
const FORMAT = /\b(formatos?|dpi|resoluci[oó]n|requisitos?|qu[eé] archivo|pdf|png|jpe?g|tiff?|espejo|c[oó]mo (lo )?(mando|preparo|env[ií]o))\b/i;
const TIMES = /\b(cu[aá]nto (tarda|demora|tiempo)|demora|plazo|en cu[aá]nto (est[aá]|lo tienen))\b/i;

/**
 * Material o servicio → casilla. El primero que coincide gana: primero el nombre del servicio que
 * dice el cliente ("vinilo DTF textil" es DTF, no lona), después el material.
 */
const SERVICE_BY_WORDS: { re: RegExp; id: string }[] = [
  { re: /\b(dtf ?uv|uv ?dtf)\b/i, id: "dtf-uv" },
  { re: /\bdtf\b/i, id: "dtf-textil" },
  { re: /\bl[aá]tex\b/i, id: "latex" },
  { re: /\b(calandra\w*)\b/i, id: "calandra" },
  { re: /\b(sublima\w*)\b/i, id: "sublimacion" },
  { re: /\b(eco ?solvente|solvente)\b/i, id: "ecosolvente" },
  { re: /\b(uv rollo|rollo a rollo)\b/i, id: "uv-rollo" },
  { re: /\b(r[ií]gidos?|pvc|acr[ií]licos?|mdf|chapas?|alto impacto|foam)\b/i, id: "uv-rigidos" },
  { re: /\b(lonas?|banners?|vinilos?|front|blackout)\b/i, id: "ecosolvente" },
  { re: /\b(cortes?|troquel\w*|ploteo de corte)\b/i, id: "corte" },
  { re: /\b(tazas?|lapiceras?|vasos?|termos?|botellas?)\b/i, id: "dtf-uv" },
  { re: /\b(remeras?|buzos?|prendas?|transfer|textil)\b/i, id: "dtf-textil" },
  { re: /\b(telas?|tropical|microfibra|jersey|tafeta|banderas?|dry ?fit)\b/i, id: "calandra" },
];

/** Pregunta fija cuando no se sabe el servicio. */
export const ASK_MATERIAL = "¡Dale! Para decirte a qué casilla mandarlo: ¿de qué material es el trabajo (lona, vinilo, tela, remeras, rígido…)?";

export function serviceFor(text: string) {
  const hit = SERVICE_BY_WORDS.find((s) => s.re.test(text));
  return hit ? help.SERVICES.find((s) => s.id === hit.id) ?? null : null;
}

/** Devuelve la respuesta fija, o null si el mensaje no es de estos flujos (lo responde la IA). */
export function fixedFlow(text: string, c: FlowContext): string | null {
  const name = c.firstName ? ` ${c.firstName}` : "";

  if (GREETING.test(text)) {
    return c.alreadyTalking ? "¿En qué te ayudo?" : `¡Hola${name}! Soy el asistente de Via Vinilo. ¿En qué te ayudo?`;
  }

  if (STATUS.test(text) && !NEW_JOB.test(text)) {
    const active = c.jobs.filter((j) => j.status !== "Entregado" && j.status !== "Cancelado");
    if (active.length === 0) {
      return "Todavía no veo pedidos tuyos en curso en el sistema. Si ya mandaste el archivo por mail, puede tardar unos minutos en aparecer. Si no, mandalo a la casilla del servicio y te pasamos el precio.";
    }
    const lines = active.slice(0, 3).map((j) => `${j.label} (${j.sector}${j.description ? `, ${j.description}` : ""}): ${j.status}`);
    const after = c.noticesOn ? " Cuando cambie, te llega un aviso por acá y por mail." : "";
    return `${active.length === 1 ? "Tu pedido" : "Tus pedidos"}: ${lines.join("; ")}.${after}`;
  }

  // Preguntas frecuentes con datos del sistema (D-060): no pasan por la IA.
  const service = serviceFor(text);
  if (HOURS.test(text) && ASKS.test(text)) {
    const centro = service && (service.id === "dtf-textil" || service.id === "dtf-uv");
    const branches = service ? [help.BRANCHES[centro ? 1 : 0]!] : help.BRANCHES;
    const lines = branches.map((b) => `${b.name}, ${b.address} (${b.services}): ${b.hours.map((h) => `${h.days} ${h.time}`).join("; ")}. Mapa: ${b.mapUrl}`);
    return lines.join("\n");
  }
  if (FORMAT.test(text) && ASKS.test(text)) {
    if (!service) return "¿Para qué servicio es? (DTF, DTF UV, calandra, sublimación, lona o vinilo, rígidos, látex o corte). Así te paso el formato exacto.";
    const warn = service.warnings?.length ? ` ${service.warnings.join(" ")}` : "";
    return `${service.name}: ${service.formats}. ${service.requirements.join(" ")}${warn} Se manda por mail a ${service.email}.`;
  }
  if (TIMES.test(text) && ASKS.test(text)) {
    const after = c.noticesOn ? " Cuando está listo te llega un aviso por acá y por mail." : "";
    return `Entre 24 y 48 horas hábiles desde que recibimos el archivo y, si corresponde, la seña. Va por orden de llegada; lo que entra el sábado a la tarde arranca el lunes.${after}`;
  }

  if (NEW_JOB.test(text)) {
    const board = boardFor(text, c.boards);
    if (board) {
      return `¡Dale! ${HOW_TO_SEND(board.email)} (${board.name}) con tus datos: nombre, medidas y cantidad, y en qué sucursal lo retirás. Cuando lo recibimos lo revisamos y te pasamos el precio.`;
    }
    if (!service) {
      return ASK_MATERIAL;
    }
    return `¡Dale! ${HOW_TO_SEND(service.email)} (${service.name}) con tus datos: nombre, medidas y cantidad, y en qué sucursal lo retirás. Formato: ${service.formats}. Cuando lo recibimos lo revisamos y te pasamos el precio.`;
  }

  return null;
}
