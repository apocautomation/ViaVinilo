/**
 * Contenido de Ayuda de la app (D-053). Lo usan la pantalla Ayuda de la app y el bot (D-056), para
 * que el bot diga exactamente lo mismo que la app. Sale de lo que hoy les dicen a los clientes los agentes de
 * Runamatic (docs/referencias/runamatic-agentes.md), que es la información que Via Vinilo ya usa.
 * En la E2 este contenido lo edita el cliente desde el ERP (contrato).
 * TODO(spec): I-27 — confirmar con Verónica las señas por servicio (los agentes de Runamatic no coinciden).
 */

export interface Service {
  id: string;
  name: string;
  group: "DTF" | "Textil" | "Gran Formato";
  /** Casilla a la que se manda el archivo. */
  email: string;
  formats: string;
  requirements: string[];
  warnings?: string[];
  guides: { label: string; url: string }[];
}

const IMG = "https://cdnj1.com/assets/318/a/1714327/images";

export const SERVICES: Service[] = [
  {
    id: "dtf-textil",
    name: "DTF Textil",
    group: "DTF",
    email: "dtf@viavinilo.com",
    formats: "PNG con fondo transparente",
    requirements: [
      "Escala 1:1 (tamaño real), entre 250 y 300 dpi, en RGB.",
      "Ancho fijo de 58 cm. Largo mínimo 0,25 cm; pliegos recomendados de hasta 2 m.",
      "Líneas de más de 3 pt (1,05 mm): las más finas no se transfieren bien.",
      "Efectos especiales (fotoluminiscente, glitter, tornasolado, oro y plata): mismo ancho, PNG a 300 dpi.",
    ],
    warnings: ["No lo mandes en espejo.", "Si mandás PDF, CDR, AI o PSD, se imprime bajo tu responsabilidad (puede variar color, tamaño o fondo)."],
    guides: [
      { label: "Cómo enviar tu archivo", url: `${IMG}/INSTRUCTIVOS-DTF-TEXTIL-ENVIOS.jpg` },
      { label: "Grosor de líneas", url: `${IMG}/INSTRUCTIVOS-DTF-TEXTIL-grosor-lineas.jpg` },
    ],
  },
  {
    id: "dtf-uv",
    name: "DTF UV",
    group: "DTF",
    email: "dtfuv@viavinilo.com",
    formats: "PNG con fondo transparente",
    requirements: ["Escala 1:1 (tamaño real), entre 250 y 300 dpi.", "Ancho de 58 cm, largo variable desde 0,25 cm."],
    warnings: ["Si mandás PDF, CDR, AI o PSD, se imprime bajo tu responsabilidad."],
    guides: [
      { label: "Cómo enviar tu archivo", url: "https://cdnj1.com/assets/1714327/images/INSTRUCTIVO-ENVIO-archivo-UV.jpg" },
      { label: "Envío paso a paso (1)", url: `${IMG}/INSTRUCTIVOS--ENVIO-archivo-2-1A.jpg` },
      { label: "Envío paso a paso (2)", url: `${IMG}/INSTRUCTIVOS--ENVIO-archivo-2-1B.jpg` },
    ],
  },
  {
    id: "sublimacion",
    name: "Sublimación",
    group: "Textil",
    email: "sublimacion@viavinilo.com",
    formats: "PDF (fuentes convertidas a curvas), JPG o TIF",
    requirements: ["Resolución de 100 a 300 dpi.", "Mínimo 50 cm lineales."],
    warnings: ["No lo mandes en espejo: el plotter lo espeja solo."],
    guides: [
      { label: "Condiciones de envío", url: `${IMG}/condiciones-envio-sublimacion.jpg` },
      { label: "Requisitos del archivo", url: `${IMG}/requisitos-envio-archivo-sublimacion.jpg` },
    ],
  },
  {
    id: "calandra",
    name: "Calandra (telas)",
    group: "Textil",
    email: "calandra@viavinilo.com",
    formats: "PDF (fuentes convertidas a curvas), JPG o TIF",
    requirements: [
      "Resolución de 100 a 300 dpi.",
      "Mínimo de 1 a 3 m según la tela.",
      "Hacé el archivo 3 cm más angosto que la tela. En tropical: 1,50 m de ancho total y 1,45 m útiles.",
    ],
    warnings: ["No lo mandes en espejo."],
    guides: [
      { label: "Requisitos", url: `${IMG}/Requisitos-Calandra.jpg` },
      { label: "Condiciones", url: `${IMG}/Condiciones-Calandra.jpg` },
    ],
  },
  {
    id: "uv-rigidos",
    name: "UV sobre rígidos",
    group: "Gran Formato",
    email: "granformato@viavinilo.com",
    formats: "PDF (fuentes a curvas), JPG o TIF",
    requirements: ["Resolución de 100 a 300 dpi.", "Respetá el área útil del material (PVC, acrílico, madera, MDF, chapa, vidrio).", "Mínimo 50 cm."],
    guides: [
      { label: "Requisitos", url: `${IMG}/RequisitosGranFormato.jpeg` },
      { label: "Área útil", url: `${IMG}/INSTRUCTIVO-AREA-UTIL.jpg` },
    ],
  },
  {
    id: "latex",
    name: "Látex",
    group: "Gran Formato",
    email: "latex@viavinilo.com",
    formats: "PDF (fuentes a curvas), JPG o TIF",
    requirements: ["Resolución de 100 a 300 dpi.", "Para vinilos, lonas, papeles y textiles."],
    warnings: ["El vinilo termotransferible sí va en espejo (es la única excepción)."],
    guides: [{ label: "Cómo enviar tu archivo", url: `${IMG}/INSTRUCTIVO-ENVIO-LATEX.jpg` }],
  },
  {
    id: "ecosolvente",
    name: "Ecosolvente",
    group: "Gran Formato",
    email: "granformato@viavinilo.com",
    formats: "PDF (fuentes a curvas), JPG o TIF",
    requirements: ["Resolución de 100 a 300 dpi.", "Verificá el ancho útil de la lona o el vinilo.", "Mínimo 50 cm."],
    guides: [
      { label: "Cómo enviar tu archivo", url: `${IMG}/INSTRUCTIVO-ENVIO-GRAN-FORMATO.jpg` },
      { label: "Área útil", url: `${IMG}/INSTRUCTIVO-AREA-UTIL.jpg` },
    ],
  },
  {
    id: "corte",
    name: "Corte",
    group: "Gran Formato",
    email: "cortes@viavinilo.com",
    formats: "Vectorial: Corel Draw (hasta la versión 24), PDF o EPS",
    requirements: ["Guías de corte de una sola línea, sin superposiciones ni nodos de más."],
    warnings: ["No se acepta PNG para corte."],
    guides: [
      { label: "Troquelado", url: `${IMG}/INSTRUCTIVO-ENVIO-TROQUELADO.jpg` },
      { label: "Cortes", url: `${IMG}/INSTRUCTIVOS-ENVIO-CORTES.jpg` },
    ],
  },
  {
    id: "uv-rollo",
    name: "UV rollo a rollo",
    group: "Gran Formato",
    email: "granformato@viavinilo.com",
    formats: "PDF (fuentes a curvas), JPG o TIF",
    requirements: ["Resolución de 100 a 300 dpi.", "Si lleva tinta blanca, barniz o relieve, mandalo separado en capas."],
    guides: [],
  },
];

/** Lo que tiene que decir siempre el mail con el archivo. */
export const MAIL_DATA = [
  "Nombre y apellido",
  "Servicio y material",
  "Medidas exactas (ancho × alto) y cantidad de copias",
  "Sucursal donde lo retirás",
  "Tu teléfono",
];
export const FILE_NAME_EXAMPLE = "Romina Méndez, DTF 58 x 36 cm x 1 u.";

export const GENERAL_GUIDES = [
  { label: "Envío de archivos en general", url: `${IMG}/INSTRUCTIVOS-ENVIO-ARCHIVOS.jpg` },
  { label: "Retiro en San Juan", url: `${IMG}/INSTRUCTIVOS-ENVIO-SAN-JUAN.jpg` },
  { label: "Límites de cada servicio", url: `${IMG}/LIMITES-DE-SERVICIO.jpg` },
];

export const BRANCHES = [
  {
    id: "chile",
    name: "Planta Av. Chile",
    address: "Av. Chile 1822, Salta",
    services: "Sublimación, Calandra, Gran Formato y ventas online",
    hours: [
      { days: "Lunes a viernes", time: "08:00 a 17:00" },
      { days: "Sábados", time: "08:00 a 12:00" },
    ],
    mapUrl: "https://shortest.link/Gpsviavinilo",
  },
  {
    id: "san-juan",
    name: "Sucursal Centro",
    address: "San Juan 714, Salta",
    services: "DTF Textil y DTF UV",
    hours: [
      { days: "Lunes a viernes", time: "08:30 a 19:30" },
      { days: "Sábados", time: "08:30 a 13:00" },
    ],
    mapUrl: "https://maps.google.com/?q=San+Juan+714,+Salta",
  },
];

/** Señas según el agente "SISTEMA NUEVO" de Runamatic (el más reciente). Ver TODO arriba. */
export const DEPOSITS = [
  { service: "DTF Textil", rule: "50% desde 10 m" },
  { service: "DTF UV", rule: "50% desde 3 m" },
  { service: "DTF TPU", rule: "50% siempre" },
  { service: "Sublimación y Calandra", rule: "50% desde 10 m" },
];

export const PAYMENTS = [
  {
    services: "Sublimación, Calandra y Gran Formato",
    method: "Transferencia a Banco Macro",
    lines: ["VIA PRINT SRL · CUIT 30-71649345-4", "CBU 2850109930094200491491", "Alias VIAPRINT.MACRO"],
  },
  { services: "DTF Textil, DTF UV y TPU", method: "Mercado Pago", lines: ["VIA PRINT SRL", "Alias viaprint.srl"] },
];

export const STORE_URL = "https://viavinilo2.mitiendanube.com";

export const FAQ = [
  {
    q: "¿Cómo sé si llegó mi archivo?",
    a: "Apenas entra, lo ves en Pedidos como \"Archivo recibido\" y en el Chat aparece tu mail. No hace falta que nos avises por WhatsApp.",
  },
  {
    q: "¿Cuánto tarda mi pedido?",
    a: "Entre 24 y 48 horas hábiles desde que recibimos el archivo y, si corresponde, la seña. Se hace por orden de llegada. Lo que llega el sábado a la tarde entra el lunes a la mañana. Te avisamos por la app cuando está listo.",
  },
  {
    q: "Mi archivo dice 300 dpi, ¿por qué sale pixelado?",
    a: "Porque lo que importa es cuántos píxeles tiene para el tamaño en que lo vas a imprimir. Si agrandás una imagen chica, o le cambiás los dpi, sigue teniendo los mismos píxeles. Un logo de 10 × 10 cm a 300 dpi necesita al menos 1181 × 1181 píxeles. Usá el archivo original en tamaño real.",
  },
  {
    q: "¿Me arreglan o diseñan el archivo?",
    a: "No. Somos mayoristas: imprimimos tal cual llega. No diseñamos, no editamos, no quitamos fondos ni mejoramos la resolución.",
  },
  {
    q: "¿Lo mando en espejo?",
    a: "No, salvo el vinilo termotransferible de Látex. En DTF, Sublimación y Calandra el espejo lo hace la máquina.",
  },
  {
    q: "¿Cómo pago la seña?",
    a: "Por transferencia o Mercado Pago, según el servicio (lo ves en \"Precios, señas y pagos\"). Mandanos el comprobante por el chat. En el mostrador se paga en efectivo o débito.",
  },
  {
    q: "¿Puede retirar un Uber o un cadete?",
    a: "Sí, pero tiene que entrar al local: no salimos a entregar. Tené en cuenta los horarios de cada sucursal.",
  },
  {
    q: "Salió con una falla, ¿qué hago?",
    a: "Traé el material fallado (film, papel o tela) al mostrador para que lo revisemos. Sin el material no podemos tomar el reclamo.",
  },
  {
    q: "¿Venden insumos (vinilos, papeles, telas)?",
    a: "Sí, en la tienda online. Este canal es para impresión, corte y calandrado.",
  },
  {
    q: "¿Puedo cambiar un pedido ya enviado?",
    a: "Escribinos por el chat antes de que esté impreso. Si mandás dos archivos en días distintos, se procesan y cotizan por separado.",
  },
];
