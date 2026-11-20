import { help } from "@viavinilo/contracts";
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
}

const GREETING = /^\s*(hola+|buenas?( tardes| noches| d[ií]as)?|buen d[ií]a|holis|qu[eé] tal)[\s!.,¿?]*$/i;
const STATUS = /\b(est[aá] listo|ya est[aá]|cu[aá]ndo (est[aá]|va a estar|lo retiro|retiro)|estado de mi|mi pedido|c[oó]mo va|lo puedo retirar)\b/i;
const NEW_JOB = /\b(imprimir|impresi[oó]n|quiero (hacer|mandar|imprimir)|te paso|necesito)\b|\d+([.,]\d+)?\s*(m|cm|mts?)?\s*[x×]\s*\d/i;

const HOURS = /\b(horarios?|d[oó]nde (queda|est[aá]n|es)|direcci[oó]n|sucursal(es)?|abren|cierran|atienden)\b/i;
const FORMAT = /\b(formatos?|dpi|resoluci[oó]n|requisitos?|qu[eé] archivo|pdf|png|jpe?g|tiff?|espejo|c[oó]mo (lo )?(mando|preparo|env[ií]o))\b/i;
const TIMES = /\b(cu[aá]nto (tarda|demora|tiempo)|demora|plazo|en cu[aá]nto (est[aá]|lo tienen))\b/i;

/** Material o servicio → casilla. El primero que coincide gana. */
const SERVICE_BY_WORDS: { re: RegExp; id: string }[] = [
  { re: /\bl[aá]tex\b/i, id: "latex" },
  { re: /\b(cortes?|troquel\w*|ploteo de corte)\b/i, id: "corte" },
  { re: /\b(r[ií]gidos?|pvc|acr[ií]licos?|mdf|chapas?|alto impacto|foam)\b/i, id: "uv-rigidos" },
  { re: /\b(lonas?|banners?|vinilos?|front|blackout|solvente|ecosolvente)\b/i, id: "ecosolvente" },
  { re: /\b(dtf uv|uv dtf|tazas?|lapiceras?|vasos?|termos?|botellas?)\b/i, id: "dtf-uv" },
  { re: /\b(dtf|remeras?|buzos?|prendas?|transfer|textil)\b/i, id: "dtf-textil" },
  { re: /\b(calandra\w*|telas?|tropical|microfibra|jersey|tafeta)\b/i, id: "calandra" },
  { re: /\b(sublima\w*|papel de sublimaci[oó]n)\b/i, id: "sublimacion" },
];

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
  if (HOURS.test(text)) {
    const centro = service && (service.id === "dtf-textil" || service.id === "dtf-uv");
    const branches = service ? [help.BRANCHES[centro ? 1 : 0]!] : help.BRANCHES;
    const lines = branches.map((b) => `${b.name}, ${b.address} (${b.services}): ${b.hours.map((h) => `${h.days} ${h.time}`).join("; ")}. Mapa: ${b.mapUrl}`);
    return lines.join("\n");
  }
  if (FORMAT.test(text) && !NEW_JOB.test(text)) {
    if (!service) return "¿Para qué servicio es? (DTF, DTF UV, calandra, sublimación, lona o vinilo, rígidos, látex o corte). Así te paso el formato exacto.";
    const warn = service.warnings?.length ? ` ${service.warnings.join(" ")}` : "";
    return `${service.name}: ${service.formats}. ${service.requirements.join(" ")}${warn} Se manda por mail a ${service.email}.`;
  }
  if (TIMES.test(text)) {
    const after = c.noticesOn ? " Cuando está listo te llega un aviso por acá y por mail." : "";
    return `Entre 24 y 48 horas hábiles desde que recibimos el archivo y, si corresponde, la seña. Va por orden de llegada; lo que entra el sábado a la tarde arranca el lunes.${after}`;
  }

  if (NEW_JOB.test(text)) {
    if (!service) {
      return "¡Dale! Para decirte a qué casilla mandarlo: ¿de qué material es el trabajo (lona, vinilo, tela, remeras, rígido…)?";
    }
    return `¡Dale! Mandá el archivo por mail a ${service.email} (${service.name}) con tus datos: nombre, medidas y cantidad, y en qué sucursal lo retirás. Formato: ${service.formats}. Cuando lo recibimos lo revisamos y te pasamos el precio.`;
  }

  return null;
}
