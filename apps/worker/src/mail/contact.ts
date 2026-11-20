import { normalizePhone } from "@viavinilo/contracts";

/**
 * Datos del remitente que vienen escritos en el cuerpo del mail (D-054). Los clientes suelen mandar
 * una ficha del estilo "Nombre o Número de Cliente: RAMIRO GARNICA / Teléfono: … / Lugar a retirar: …".
 * Con eso se completa el alta pendiente para que el asesor solo tenga que verificar.
 * Cuando esté el bot (E2), él completa lo que esta lectura no entienda.
 */
export interface MailContact {
  firstName: string | null;
  lastName: string | null;
  /** E.164, ya normalizado. */
  phone: string | null;
  /** Número de cliente que dice tener (ej. "Nombre o Número de Cliente: 1234"). */
  claimedCustomerNumber: number | null;
  pickup: string | null;
}

const LINE = (labels: string) => new RegExp(`^[\\s>*_-]*(?:${labels})\\s*[:=-]\\s*(.+)$`, "im");

const NAME = LINE(
  "nombre\\s+o\\s+n[uú]mero\\s+de\\s+cliente|nombre\\s+y\\s+apellido|apellido\\s+y\\s+nombre|nombre\\s+completo|nombre|cliente",
);
const PHONE = LINE("tel[eé]fono|tel|celular|cel|whats\\s*app|wsp|wpp|contacto");
const PICKUP = LINE("lugar\\s+(?:a|de)\\s+retir(?:ar|o)|sucursal(?:\\s+de\\s+retiro)?|retir[oa]\\s+en|retiro");

/** "RAMIRO GARNICA" → "Ramiro Garnica". Respeta "de", "del", "la" en minúscula. */
function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => (i > 0 && ["de", "del", "la", "las", "los", "y"].includes(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

/** Separa nombre y apellido: el último término es el apellido, salvo partículas ("de la Fuente"). */
export function splitName(full: string): { firstName: string | null; lastName: string | null } {
  const clean = full
    .replace(/["“”<>()[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Un nombre razonable: solo letras, de 1 a 5 palabras, sin arrobas ni números.
  if (!clean || clean.length > 60 || !/^[\p{L}' .-]+$/u.test(clean)) return { firstName: null, lastName: null };
  const words = titleCase(clean).split(" ").filter(Boolean);
  if (words.length > 5) return { firstName: null, lastName: null };
  if (words.length === 1) return { firstName: words[0]!, lastName: null };
  let cut = words.length - 1;
  while (cut > 1 && ["de", "del", "la", "las", "los"].includes(words[cut - 1]!)) cut--;
  return { firstName: words.slice(0, cut).join(" "), lastName: words.slice(cut).join(" ") };
}

export function extractContact(text: string, fromName: string | null): MailContact {
  const out: MailContact = { firstName: null, lastName: null, phone: null, claimedCustomerNumber: null, pickup: null };

  const name = NAME.exec(text)?.[1]?.trim();
  if (name) {
    const number = /^(?:n[°º.o]*\s*)?(\d{1,7})$/i.exec(name.replace(/\s+/g, " "));
    if (number) out.claimedCustomerNumber = Number(number[1]);
    else Object.assign(out, splitName(name));
  }
  // Sin nombre en el cuerpo, se usa el que muestra el mail en "De:" (si parece un nombre de persona).
  if (!out.firstName && fromName) Object.assign(out, splitName(fromName));

  const phone = PHONE.exec(text)?.[1];
  if (phone) out.phone = normalizePhone(phone.replace(/[^\d+]/g, " ").trim());

  const pickup = PICKUP.exec(text)?.[1]?.trim();
  if (pickup) out.pickup = titleCase(pickup).slice(0, 80);

  return out;
}
