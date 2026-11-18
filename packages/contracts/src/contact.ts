import { parsePhoneNumberFromString } from "libphonenumber-js";

/** Los emails se guardan siempre en minúsculas y sin espacios: así se identifica al remitente de un mail. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Normaliza un teléfono a E.164. Los números sin código de país se toman como argentinos.
 *
 * Los números argentinos se guardan siempre en la forma de celular +549…, la que usa WhatsApp:
 * "387 466-9944", "0387 15 466-9944" y "+54 9 387 466-9944" son el mismo cliente.
 * TODO(spec): I-12 — un teléfono fijo también recibe el 9; confirmar que no se cargan fijos.
 * Devuelve null si el número no es válido.
 */
export function normalizePhone(phone: string): string | null {
  const parsed = parsePhoneNumberFromString(phone.trim(), "AR");
  if (!parsed?.isValid()) return null;
  if (parsed.country !== "AR" || parsed.number.startsWith("+549")) return parsed.number;
  const mobile = parsePhoneNumberFromString(`+549${parsed.nationalNumber}`);
  return mobile?.isValid() ? mobile.number : parsed.number;
}

/**
 * Texto de búsqueda: minúsculas, sin tildes y con espacios simples. "José  Núñez" → "jose nunez".
 * En el mostrador se busca casi siempre sin tildes.
 */
export function normalizeSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Texto de búsqueda de un cliente: nombre y apellido normalizados. */
export function customerSearchText(c: { firstName?: string | null; lastName?: string | null }): string {
  return normalizeSearch(`${c.firstName ?? ""} ${c.lastName ?? ""}`);
}

/** El DNI se guarda solo con dígitos (sin puntos ni espacios). */
export function normalizeDni(dni: string): string {
  return dni.replace(/\D/g, "");
}
