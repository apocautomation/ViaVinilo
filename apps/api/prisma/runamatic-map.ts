import {
  customerSearchText,
  emailSchema,
  isValidCuit,
  normalizeCuit,
  normalizeDni,
  normalizePhone,
  type TaxCondition,
} from "@viavinilo/contracts";

/**
 * Pasa una fila del CSV de clientes de Runamatic a un cliente de Via Vinilo (D-048, D-049).
 * Es una función pura: la usa el script de importación y se prueba sin base.
 */
export interface MappedCustomer {
  firstName: string;
  lastName: string | null;
  searchText: string;
  dni: string | null;
  email: string | null;
  phone: string | null;
  cuit: string | null;
  taxCondition: TaxCondition | null;
  fiscalAddress: string | null;
  internalNotes: string;
  /** Datos del CSV que no se pudieron usar, para revisar a mano. */
  warnings: string[];
}

/** Parser CSV con comillas (RFC 4180). Devuelve filas de texto, la primera es el encabezado. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const t = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < t.length; i++) {
    const c = t[i]!;
    if (quoted) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim()));
}

/** "Consumidor final", "consumidor final", "Monotributista"… → la condición del sistema. */
export function mapTaxCondition(raw: string): TaxCondition | null {
  const v = raw
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
  if (!v) return null;
  if (v.includes("consumidor")) return "CONSUMIDOR_FINAL";
  if (v.startsWith("monotribut")) return "MONOTRIBUTO";
  if (v.includes("responsable") && v.includes("inscript")) return "RESPONSABLE_INSCRIPTO";
  if (v.includes("exent")) return "EXENTO";
  return null;
}

const clean = (s: string | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

export function mapRunamaticRow(header: string[], row: string[], importedOn: string): MappedCustomer {
  const get = (name: string) => clean(row[header.indexOf(name)]);
  const warnings: string[] = [];

  const name = get("Nombre completo") || "Sin nombre";
  const [first, ...rest] = name.split(" ");
  const firstName = first!;
  const lastName = rest.join(" ") || null;

  const rawPhone = get("Teléfono").replace(/\D/g, "");
  const phone = rawPhone ? normalizePhone(rawPhone.startsWith("54") ? `+${rawPhone}` : rawPhone) : null;
  if (rawPhone && !phone) warnings.push(`teléfono no válido: ${get("Teléfono")}`);

  const rawEmail = get("Email");
  const parsedEmail = rawEmail ? emailSchema.safeParse(rawEmail) : null;
  const email = parsedEmail?.success ? parsedEmail.data : null;
  if (rawEmail && !email) warnings.push(`email no válido: ${rawEmail}`);

  const rawDni = normalizeDni(get("DNI"));
  const dni = /^\d{7,8}$/.test(rawDni) ? rawDni : null;
  if (get("DNI") && !dni) warnings.push(`DNI no válido: ${get("DNI")}`);

  const rawCuit = get("CUIT o CUIL");
  const cuit = rawCuit && isValidCuit(rawCuit) ? normalizeCuit(rawCuit) : null;
  if (rawCuit && !cuit) warnings.push(`CUIT no válido: ${rawCuit}`);

  const rawTax = get("Condición ante IVA");
  const taxCondition = mapTaxCondition(rawTax);
  if (rawTax && !taxCondition) warnings.push(`condición IVA "${rawTax}"`);

  const notes = [
    `Importado de Runamatic el ${importedOn}.`,
    get("Origen del chat") && `Origen: ${get("Origen del chat")}.`,
    get("Etiquetas") && `Etiquetas: ${get("Etiquetas")}.`,
    warnings.length ? `Revisar: ${warnings.join("; ")}.` : "",
  ].filter(Boolean);

  return {
    firstName,
    lastName,
    searchText: customerSearchText({ firstName, lastName }),
    dni,
    email,
    phone,
    cuit,
    taxCondition,
    fiscalAddress: get("domicilio") || null,
    internalNotes: notes.join(" "),
    warnings,
  };
}
