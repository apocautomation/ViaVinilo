import { help } from "@viavinilo/contracts";
import { boardFor, jobLine, jobNumberIn, serviceFor, type ExtraBoard } from "./flows";
import type { BotJob } from "./prompt";

/**
 * Herramientas del bot (D-097), como el agente de Trip: la IA decide qué responder y, cuando necesita
 * un dato, lo pide acá. Los datos salen del sistema y de la Ayuda, nunca del modelo: así la IA puede
 * hablar con naturalidad sin inventar el estado de un pedido, una casilla o un horario.
 */

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: { type: "object"; properties: Record<string, unknown>; required?: string[] };
}

export interface ToolContext {
  jobs: BotJob[];
  boards?: ExtraBoard[];
  noticesOn: boolean;
}

/** Lo que dejó la conversación con las herramientas: cuáles usó y si derivó. */
export interface ToolKit {
  definitions: ToolDefinition[];
  run: (name: string, args: Record<string, unknown>) => string;
  used: string[];
  handoff: { reason: string } | null;
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "ver_mis_pedidos",
    description:
      "Pedidos del cliente en el sistema, con estado, archivos recibidos, problema del archivo, precio y seña. Usala SIEMPRE antes de decir algo de un pedido o de un archivo (si llegó, si está bien, si está listo). Si el cliente nombra un número de pedido, pasalo.",
    parameters: { type: "object", properties: { numero: { type: "integer", description: "Número de pedido que nombró el cliente, por ejemplo 51 para VV-000051. Opcional." } } },
  },
  {
    name: "info_servicio",
    description: "Cómo preparar y mandar el archivo de un servicio: formato, requisitos, casilla de mail, sucursal donde se retira y seña. Pasá el material o servicio que dijo el cliente (remeras, lona, tela, tazas, rígidos, látex, DTF…).",
    parameters: { type: "object", properties: { servicio: { type: "string" } }, required: ["servicio"] },
  },
  {
    name: "sucursales_y_horarios",
    description: "Dirección, horarios y mapa de las dos sucursales, y qué se retira en cada una.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "datos_de_pago",
    description: "Alias, CBU y medio de pago para pagar una seña o un pedido. Si sabés el servicio, pasalo.",
    parameters: { type: "object", properties: { servicio: { type: "string" } } },
  },
  {
    name: "preguntas_frecuentes",
    description: "Respuestas oficiales de Via Vinilo: espejo, diseño, quién puede retirar, envíos, señas por servicio, tiempos de entrega, insumos y tienda.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "derivar_a_asesor",
    description:
      "Pasa la conversación a una persona del equipo y apaga el bot en este chat. Usala para precios o presupuestos, cancelar o cambiar un pedido, reclamos, comprobantes de pago, urgencias, cambios de sucursal, si pide una persona o si no sabés qué responder.",
    parameters: { type: "object", properties: { motivo: { type: "string" } }, required: ["motivo"] },
  },
];

const isCentro = (id: string) => id === "dtf-textil" || id === "dtf-uv";

export function buildToolKit(c: ToolContext): ToolKit {
  const kit: ToolKit = { definitions: TOOL_DEFINITIONS, used: [], handoff: null, run: () => "" };
  const active = c.jobs.filter((j) => j.status !== "Entregado" && j.status !== "Cancelado");
  const shape = (j: BotJob) => ({
    pedido: j.label,
    servicio: j.sector,
    estado: j.status,
    detalle: j.description,
    archivos: j.files === undefined ? "sin dato" : j.files.length ? j.files : "ninguno",
    link_sin_bajar: j.hasLinks && j.files !== undefined && j.files.length === 0 ? true : undefined,
    problema_del_archivo: j.fileIssue ?? undefined,
    control_del_archivo: j.fileCheck === "ok" ? "dio bien" : j.fileCheck === "review" ? "lo revisa el equipo" : undefined,
    precio: j.quotedAmount ?? undefined,
    sena: j.depositRequired ? (j.depositPaid ? "pagada" : `pendiente${j.depositAmount ? ` (${j.depositAmount})` : ""}`) : undefined,
    // La frase ya armada con los datos: la IA la puede usar tal cual o decirla con sus palabras.
    resumen: jobLine(j),
  });

  kit.run = (name, args) => {
    kit.used.push(name);
    switch (name) {
      case "ver_mis_pedidos": {
        const n = typeof args.numero === "number" ? args.numero : typeof args.numero === "string" ? jobNumberIn(`pedido ${args.numero}`) : null;
        if (n !== null) {
          const one = c.jobs.find((j) => Number(j.label.replace(/\D/g, "")) === n);
          if (!one) return JSON.stringify({ error: `No hay un pedido número ${n} a nombre de este cliente.`, pedidos_en_curso: active.slice(0, 5).map(shape) });
          return JSON.stringify({ pedido: shape(one) });
        }
        return JSON.stringify({
          pedidos_en_curso: active.slice(0, 5).map(shape),
          total_en_curso: active.length,
          entregados_recientes: c.jobs.filter((j) => j.status === "Entregado").slice(0, 2).map((j) => ({ pedido: j.label, servicio: j.sector })),
          avisos_automaticos: c.noticesOn ? "prendidos: cuando cambia el estado le llega un aviso" : "apagados: no prometas avisos",
        });
      }
      case "info_servicio": {
        const text = String(args.servicio ?? "");
        const board = boardFor(text, c.boards);
        if (board) return JSON.stringify({ servicio: board.name, casilla: board.email ?? "sin casilla: mandarlo con el clip del chat", como_mandarlo: "Con el clip 📎 del chat eligiendo el servicio, o por mail." });
        const s = serviceFor(text) ?? help.SERVICES.find((x) => x.name.toLowerCase().includes(text.toLowerCase().trim()));
        if (!s) return JSON.stringify({ error: "No sé qué servicio es. Preguntale el material.", servicios: help.SERVICES.map((x) => x.name) });
        const branch = help.BRANCHES[isCentro(s.id) ? 1 : 0]!;
        return JSON.stringify({
          servicio: s.name,
          formato: s.formats,
          requisitos: s.requirements,
          importante: s.warnings ?? [],
          casilla: s.email,
          como_mandarlo: "Con el clip 📎 del chat (elige el servicio, escribe medidas y cantidad) o por mail a la casilla con nombre, medidas, cantidad y sucursal.",
          se_retira_en: `${branch.name}, ${branch.address}`,
          sena: help.DEPOSITS.find((d) => d.service.toLowerCase().includes(s.name.toLowerCase().split(" ")[0]!))?.rule ?? null,
        });
      }
      case "sucursales_y_horarios":
        return JSON.stringify(help.BRANCHES.map((b) => ({ sucursal: b.name, direccion: b.address, servicios: b.services, horarios: b.hours.map((h) => `${h.days} ${h.time}`), mapa: b.mapUrl })));
      case "datos_de_pago": {
        const s = args.servicio ? serviceFor(String(args.servicio)) : null;
        const list = s ? [help.PAYMENTS[isCentro(s.id) ? 1 : 0]!] : [...help.PAYMENTS];
        return JSON.stringify({ pagos: list.map((p) => ({ servicios: p.services, medio: p.method, datos: p.lines })), comprobante: "Se manda por este chat. En el mostrador, efectivo o débito." });
      }
      case "preguntas_frecuentes":
        return JSON.stringify({
          preguntas: help.FAQ.map((f) => ({ pregunta: f.q, respuesta: f.a })),
          senas: help.DEPOSITS.map((d) => `${d.service}: ${d.rule}`),
          tiempos: "Entre 24 y 48 horas hábiles desde que recibimos el archivo y, si corresponde, la seña. Por orden de llegada.",
          tienda_de_insumos: help.STORE_URL,
        });
      case "derivar_a_asesor":
        kit.handoff = { reason: String(args.motivo ?? "El bot derivó a un asesor").slice(0, 300) };
        return JSON.stringify({ ok: true, decile: "que un asesor del equipo le responde por este mismo chat" });
      default:
        return JSON.stringify({ error: `No existe la herramienta ${name}` });
    }
  };
  return kit;
}
