import { help, normalizeSearch } from "@viavinilo/contracts";
import type { BotJob } from "./prompt";

/**
 * Flujos fijos del bot, sin IA (D-060, D-066). Son las respuestas que no pueden fallar: el modelo
 * local es chico y llegó a inventar "el archivo se recibió" o "sí, hacemos envíos". Todo lo que se
 * puede contestar con datos del sistema se contesta acá; la IA queda para lo demás.
 */

export interface FlowContext {
  firstName: string | null;
  alreadyTalking: boolean;
  noticesOn: boolean;
  jobs: BotJob[];
  /** Tableros creados desde el ERP (D-064), además de los servicios de base. */
  boards?: ExtraBoard[];
  /** Para "¿hasta qué hora atienden hoy?". */
  now?: Date;
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

const GREETING = /^\s*(h?ola+|buenas?( tardes| noches| d[ií]as)?|buen d[ií]a|holis|qu[eé] tal)[\s!.,¿?]*$/i;
/** Cierre corto: "gracias", "ok", "dale", "listo"… No es un pedido ni una pregunta. */
const THANKS = /^\s*(much[ií]simas |muchas |mil )?(gracias|ok(ey)?|oka|dale|listo|perfecto|genial|buen[ií]simo|b[aá]rbaro|joya|de una)\b[^?]{0,25}$/i;
const STATUS = /\b(est[aá] listo|ya est[aá]|cu[aá]ndo (est[aá]|va a estar|lo retiro|retiro)|estado de mi|mi pedido|c[oó]mo va|lo puedo retirar)\b/i;
/**
 * Pregunta por su archivo (D-092): "¿tenés mi archivo?", "¿llegó?", "¿está correcto?", "¿tiene algún
 * error?". Se contesta con el estado real del pedido; la IA inventaba "apenas llegue lo veo".
 */
/** Se prueba sobre el texto sin tildes: "\\b" no corta bien después de una vocal acentuada. */
const FILE_QUESTION =
  /\b(archi[bv]os?|disenos?|mail|correo|pedidos?|orden(es)?)\b.{0,40}\b(llego|recib\w+|tenes|tienen|vieron|viste|esta (bien|correcto|ok|mal)|sirve|error|problema)\b|\b(llego|recib\w+|tenes|tienen|vieron|viste)\b.{0,40}\b(archi[bv]os?|disenos?|mail|correo)\b|^\s*¿?\s*(esta|estaba|quedo|salio) (todo )?(bien|correcto|ok|mal)\b|\b(tiene|tenia|tuvo|hay|hubo) (algun )?(error|problema)\b|\bque (le )?(pasa|paso|onda)\b.{0,30}\b(archivos?|disenos?|pedidos?|trabajos?)\b|\b(archivos?|disenos?|pedidos?|trabajos?)\b.{0,30}\b(no avanza|sigue igual|trabado|frenado|parado)\b|\bpor ?que no (avanza|sale|lo hacen|lo imprimen)\b|\b(mi|mis) (archivos?|disenos?)\b.*\?/i;
const plain = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "");
/** Un trabajo nuevo: pide imprimir, manda medidas o un archivo, o avisa que adjunta (D-060, D-061). */
const NEW_JOB =
  /\b(imprimir|impresi[oó]n|quiero (hacer|mandar|imprimir)|te paso|necesito|adjunto|adjunta|ah[ií] va|te mando|les? (env[ií]o|mando|paso)|env[ií]o (el|un|los|unos|este)? ?archivos?|archivos? para)\b|\d+([.,]\d+)?\s*(m|cm|mts?)?\s*[x×]\s*\d|\.(png|jpe?g|pdf|tiff?|eps|ai|cdr|psd)\b/i;

/** Las preguntas frecuentes se responden solo si el cliente pregunta (D-061): "lo retiro en la sucursal" es un dato. */
const ASKS =
  /\?|^\s*(d[oó]nde|qu[eé]|cu[aá]l|cu[aá]ndo|cu[aá]nto|a qu[eé] hora|hasta qu[eé] hora|c[oó]mo|puedo|se puede|tienen|hay|hacen|venden|abren|me pas[aá]s|me pod[eé]s|pasame)\b/i;
const WHERE = /\b(d[oó]nde|direcci[oó]n|ubicaci[oó]n|sucursal(es)?|c[oó]mo llego|mapa)\b/i;
const HOURS = /\b(horarios?|abren|cierran|atienden|abiert[oa]s?|hasta qu[eé] hora|a qu[eé] hora)\b/i;
const SATURDAY = /\bs[aá]bados?\b/i;
const TODAY = /\b(hoy|ahora)\b/i;
const MIRROR = /\b(espejo|espejad\w*)\b/i;
const DESIGN = /\b(dise[ñn]\w*|vectoriz\w*|retoc\w*|arregl\w* (el|mi) archivo|(sacar|quitar)\w* el fondo)\b/i;
const PAY = /\b(alias|cbu|c[oó]mo (pago|se paga|abono|transfiero)|(medios?|formas?) de pago|d[oó]nde (pago|transfiero|deposito)|datos (bancarios|para transferir|de pago|de la cuenta)|para transferir|mercado ?pago)\b/i;
const DEPOSIT = /\bse[ñn]as?\b/i;
const THIRD_PARTY = /\b(cadete|uber|moto|comisionista|otra persona|un tercero|un amigo|mi (hermano|hermana|pareja|empleado))\b/i;
const SHIPPING = /\b(env[ií]os?|env[ií]an|mandan|a domicilio|correo|encomienda|despach\w*|otra provincia|al interior)\b/i;
const SUPPLIES = /\b(venden|vend[eé]s|insumos?|comprar|tienda)\b/i;
const SERVICES = /\b(qu[eé] servicios|servicios (tienen|ofrecen|hacen)|qu[eé] (hacen|imprimen|trabajos hacen)|a qu[eé] se dedican)\b/i;
const CONTACT = /\b(whats ?app|wsp|wpp|tel[eé]fono|n[uú]mero|llamar|celular)\b/i;
const FORMAT = /\b(formatos?|dpi|resoluci[oó]n|requisitos?|qu[eé] archivo|pdf|png|jpe?g|tiff?|c[oó]mo (lo |tengo que )?(mando|mandar|preparo|preparar|env[ií]o|enviar))\b/i;
const TIMES = /\b(cu[aá]nto (tarda|tardan|demora|demoran|tiempo)|demora|plazo|para cu[aá]ndo|en cu[aá]nto (est[aá]|lo tienen))\b/i;

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

/** DTF y DTF UV se retiran y se pagan en la Sucursal Centro; el resto, en la Planta de Av. Chile. */
const isCentro = (serviceId: string) => serviceId === "dtf-textil" || serviceId === "dtf-uv";
type Branch = (typeof help.BRANCHES)[number];
const faq = (start: string) => help.FAQ.find((f) => f.q.startsWith(start))!.a;

/** Una sucursal en pocas líneas: nombre y dirección, qué se hace ahí, horario y mapa. */
function branchCard(b: Branch): string {
  return [`${b.name} · ${b.address}`, b.services, b.hours.map((h) => `${h.days} de ${h.time}`).join(" · "), `Mapa: ${b.mapUrl}`].join("\n");
}

function whereAndWhen(text: string, serviceId: string | null, now: Date | undefined): string {
  const branches = serviceId ? [help.BRANCHES[isCentro(serviceId) ? 1 : 0]!] : [...help.BRANCHES];
  // "¿Abren los sábados?"
  if (SATURDAY.test(text)) {
    return `Sí, los sábados a la mañana: ${branches.map((b) => `${b.name} de ${b.hours[1]!.time}`).join(" y ")}.`;
  }
  // "¿Hasta qué hora atienden hoy?"
  if (TODAY.test(text) && HOURS.test(text) && now) {
    const day = now.toLocaleString("en-US", { timeZone: "America/Argentina/Salta", weekday: "short" });
    if (day === "Sun") return `Hoy domingo está cerrado. ${branches.map((b) => `${b.name}: ${b.hours[0]!.days.toLowerCase()} de ${b.hours[0]!.time}`).join("; ")}.`;
    const i = day === "Sat" ? 1 : 0;
    return `Hoy atendemos: ${branches.map((b) => `${b.name} de ${b.hours[i]!.time}`).join(" y ")}.`;
  }
  if (branches.length === 1) return branchCard(branches[0]!);
  return `Tenemos dos sucursales:\n\n${branches.map(branchCard).join("\n\n")}\n\nEl pedido se retira en la sucursal del servicio. ¿Para cuál es?`;
}

function howToPay(serviceId: string | null): string {
  const list = serviceId ? [help.PAYMENTS[isCentro(serviceId) ? 1 : 0]!] : [...help.PAYMENTS];
  const blocks = list.map((p) => [`${p.services}: ${p.method}`, ...p.lines].join("\n"));
  return `${blocks.join("\n\n")}\n\nMandá el comprobante por este chat. En el mostrador se paga en efectivo o débito.`;
}

const ars = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 });

/** "VV-000021", "pedido 21", "orden #21" → 21. */
export function jobNumberIn(text: string): number | null {
  const m = /\b(?:vv[\s-]*0*|(?:pedido|orden|trabajo)\s*(?:n(?:ro|um(?:ero)?)?[.°º]*\s*)?#?\s*0*)(\d{1,7})\b/i.exec(text.normalize("NFD").replace(/\p{Diacritic}/gu, ""));
  return m ? Number(m[1]) : null;
}

/** Un pedido en una línea, con lo que el cliente necesita saber del archivo (D-092, D-094). */
/**
 * Dónde retira el cliente un pedido (D-099): la sucursal que eligió o, si no eligió, la del servicio
 * (DTF Textil, DTF UV y TPU en San Juan; el resto en Av. Chile).
 */
export function pickupOf(j: Pick<BotJob, "pickupBranch" | "sector">): (typeof help.BRANCHES)[number] {
  const id = j.pickupBranch ?? (/^(dtf|tpu)/i.test(j.sector) ? "san-juan" : "chile");
  return help.BRANCHES.find((b) => b.id === id) ?? help.BRANCHES[0]!;
}

export function jobLine(j: BotJob): string {
  const base = `${j.label} (${j.sector}${j.description ? `, ${j.description}` : ""})`;
  if (j.status === "Terminado, listo para retirar") {
    // D-099: el cliente lo que quiere saber es dónde y hasta qué hora.
    const b = pickupOf(j);
    return `${base}: está listo para retirar en ${b.name}, ${b.address} (${b.hours.map((h) => `${h.days} ${h.time}`).join("; ")})`;
  }
  const clip = `con el clip 📎 de este chat, eligiendo el pedido ${j.label}`;
  const names = j.files?.length ? ` (${j.files.slice(0, 2).join(", ")}${j.files.length > 2 ? ` y ${j.files.length - 2} más` : ""})` : "";
  if (j.status === "Archivo con error") {
    return `${base}: el archivo tiene un problema${j.fileIssue ? `: ${j.fileIssue}` : ""}. Mandalo corregido ${clip}`;
  }
  // D-094: se sabe que el pedido no tiene ningún archivo guardado.
  const missing = j.files !== undefined && j.files.length === 0;
  if (j.status === "Archivo recibido") {
    if (missing) {
      return j.hasLinks
        ? `${base}: recibimos el pedido con el link del archivo, pero todavía no lo pudimos bajar. Si podés, mandalo ${clip}`
        : `${base}: tengo el pedido, pero todavía no tengo ningún archivo. Mandalo ${clip}`;
    }
    if (j.fileCheck === "ok") return `${base}: recibimos el archivo y el control automático dio bien${names}. Falta que lo coticemos`;
    if (j.fileCheck === "review") return `${base}: recibimos el archivo y lo está revisando el equipo antes de cotizar${names}`;
    return `${base}: recibimos el archivo${names}. Lo revisamos y te pasamos el precio`;
  }
  if (j.status === "Cotizado" && j.quotedAmount) {
    // D-093: el cliente pregunta "¿está listo?" y lo que le falta saber es el precio y la seña.
    const price = `cotizado en ${ars.format(Number(j.quotedAmount))}`;
    if (j.depositRequired && !j.depositPaid) {
      return `${base}: ${price}. Para empezar falta la seña${j.depositAmount ? ` de ${ars.format(Number(j.depositAmount))}` : ""}; si querés los datos para pagarla, pedime el alias`;
    }
    return `${base}: ${price}`;
  }
  return `${base}: ${j.status}`;
}

/** Pregunta por el estado de un pedido o por su archivo (D-097): la IA no puede contestarla sin mirar los pedidos. */
export function asksAboutOrders(text: string): boolean {
  return (STATUS.test(plain(text)) || FILE_QUESTION.test(plain(text)) || jobNumberIn(text) !== null) && !NEW_JOB.test(text);
}

/**
 * Qué herramienta tiene que haber usado la IA para responder este mensaje (D-098). Si no la usó, su
 * respuesta no se basa en datos del sistema y se reemplaza por la armada. Mismo orden que fixedFlow.
 */
/**
 * "¿En qué sucursal?" o "¿dónde lo retiro?" con un pedido listo para retirar (D-100): se refiere a su
 * pedido, no a las sucursales en general. "¿Hasta qué hora abren?" sigue siendo de horarios.
 */
const asksWhereToPickUp = (text: string, jobs?: BotJob[]) =>
  ASKS.test(text) && (WHERE.test(text) || /\bretir\w*/i.test(text)) && !HOURS.test(text) && !!jobs?.some((j) => j.status === "Terminado, listo para retirar");

export function toolFor(text: string, jobs?: BotJob[]): string | null {
  if (GREETING.test(text) || THANKS.test(text)) return null;
  if (asksAboutOrders(text) || asksWhereToPickUp(text, jobs)) return "ver_mis_pedidos";
  const asks = ASKS.test(text);
  if (asks && PAY.test(text)) return "datos_de_pago";
  if (asks && (MIRROR.test(text) || DESIGN.test(text) || DEPOSIT.test(text) || THIRD_PARTY.test(text) || SUPPLIES.test(text) || TIMES.test(text))) return "preguntas_frecuentes";
  if (asks && SHIPPING.test(text) && !/\barchivos?\b/i.test(text)) return "preguntas_frecuentes";
  if (asks && (WHERE.test(text) || HOURS.test(text) || /\bretir\w*/i.test(text))) return "sucursales_y_horarios";
  if ((asks && FORMAT.test(text)) || NEW_JOB.test(text)) return "info_servicio";
  return null;
}

/** Es una pregunta (D-098): si la IA la contesta sin ninguna herramienta, no tiene de dónde sacar el dato. */
export const isQuestion = (text: string) => ASKS.test(text) && !GREETING.test(text) && !THANKS.test(text);

/** "gracias", "ok dale" (D-101): se cierra con la respuesta fija; la IA volvía a ofrecer ayuda. */
export const isThanks = (text: string) => THANKS.test(text);

/** Devuelve la respuesta fija, o null si el mensaje no es de estos flujos (lo responde la IA). */
export function fixedFlow(text: string, c: FlowContext): string | null {
  const name = c.firstName ? ` ${c.firstName}` : "";

  if (GREETING.test(text)) {
    return c.alreadyTalking ? "¿En qué te ayudo?" : `¡Hola${name}! Soy el asistente de Via Vinilo. ¿En qué te ayudo?`;
  }
  if (THANKS.test(text)) return /gracias/i.test(text) ? "¡De nada! Cualquier cosa, escribime por acá." : "¡Dale! Cualquier cosa, escribime por acá.";

  if ((STATUS.test(plain(text)) || FILE_QUESTION.test(plain(text))) && !NEW_JOB.test(text)) {
    const active = c.jobs.filter((j) => j.status !== "Entregado" && j.status !== "Cancelado");
    if (active.length === 0) {
      return "Todavía no veo pedidos tuyos en curso. Si mandaste el archivo recién, puede tardar unos minutos en aparecer. Si todavía no lo mandaste, usá el clip 📎 de este chat y te pasamos el precio.";
    }
    const after = c.noticesOn ? " Cuando cambie, te llega un aviso por acá y por mail." : "";
    // D-094: si nombra un pedido ("VV-21", "pedido 21"), se responde por ese.
    const asked = jobNumberIn(text);
    if (asked !== null) {
      const one = c.jobs.find((j) => Number(j.label.replace(/\D/g, "")) === asked);
      if (one) return `${jobLine(one)}.${one.status === "Entregado" || one.status === "Cancelado" ? "" : after}`;
      return `No encuentro un pedido con el número ${asked} a tu nombre. ${active.length === 1 ? "El que tenés en curso" : "Los que tenés en curso"}: ${active.slice(0, 3).map(jobLine).join("; ")}.`;
    }
    const lines = active.slice(0, 3).map(jobLine);
    if (active.length > 1) {
      // Con varios pedidos se pregunta a cuál se refiere, mostrando cada uno con su archivo.
      const more = active.length > 3 ? ` (y ${active.length - 3} más en Pedidos)` : "";
      return `Tenés ${active.length} pedidos en curso${more}:\n${lines.map((l) => `• ${l}.`).join("\n")}\n¿Por cuál me consultás? Decime el número.`;
    }
    return `Tu pedido: ${lines.join("; ")}.${after}`;
  }

  // Preguntas frecuentes con datos del sistema (D-060, D-066): no pasan por la IA.
  const service = serviceFor(text);
  const asks = ASKS.test(text);
  if (asks && MIRROR.test(text)) return faq("¿Lo mando en espejo?");
  if (asks && DESIGN.test(text)) return faq("¿Me arreglan o diseñan");
  if (asks && PAY.test(text)) return howToPay(service?.id ?? null);
  if (asks && DEPOSIT.test(text)) {
    return `Se pide seña según el servicio y los metros:\n${help.DEPOSITS.map((d) => `${d.service}: ${d.rule}`).join("\n")}\n\nCon la seña paga, el pedido entra a producción. Si querés los datos para pagarla, pedime el alias.`;
  }
  if (asks && THIRD_PARTY.test(text)) return faq("¿Puede retirar un Uber");
  if (asks && SHIPPING.test(text) && !/\barchivos?\b/i.test(text)) {
    return "Los pedidos se retiran en la sucursal. Puede pasar un cadete o un Uber, pero tiene que entrar al local. Si necesitás que te lo envíen, decime y te paso con un asesor.";
  }
  if (asks && SUPPLIES.test(text)) {
    return `Los insumos (vinilos, papeles, telas) se compran en la tienda online: ${help.STORE_URL}\nEste chat es para impresión, corte y calandrado.`;
  }
  if (asks && SERVICES.test(text)) {
    const all = [...help.SERVICES.map((s) => s.name), ...(c.boards ?? []).map((b) => b.name)];
    return `Hacemos: ${all.join(", ")}.\n¿Cuál necesitás? Te digo cómo mandar el archivo.`;
  }
  if (asks && CONTACT.test(text)) {
    return "Atendemos por este chat de la app. Si necesitás hablar con una persona, decime y te paso con un asesor.";
  }
  if (asksWhereToPickUp(text, c.jobs)) {
    const ready = c.jobs.filter((j) => j.status === "Terminado, listo para retirar");
    return `${ready.length === 1 ? "Tu pedido" : "Tus pedidos"}: ${ready.slice(0, 3).map(jobLine).join("; ")}.`;
  }
  if (asks && (WHERE.test(text) || HOURS.test(text) || /\bretir\w*/i.test(text))) return whereAndWhen(text, service?.id ?? null, c.now);
  if (asks && FORMAT.test(text)) {
    if (!service) return "¿Para qué servicio es? (DTF, DTF UV, calandra, sublimación, lona o vinilo, rígidos, látex o corte). Así te paso el formato exacto.";
    const warn = service.warnings?.length ? `\n${service.warnings.join(" ")}` : "";
    return `${service.name}: ${service.formats}.\n${service.requirements.join(" ")}${warn}\n${HOW_TO_SEND(service.email)}.`;
  }
  if (asks && TIMES.test(text)) {
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
