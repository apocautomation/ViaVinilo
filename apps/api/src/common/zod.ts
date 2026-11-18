import { BadRequestException, Body, PipeTransform, Query } from "@nestjs/common";
import type { ZodType } from "zod";

/** Valida y transforma con un schema de @viavinilo/contracts. Los errores vuelven por campo, en español. */
export class ZodPipe implements PipeTransform {
  constructor(private readonly schema: ZodType) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;
    const errors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join(".") || "_";
      errors[key] ??= issue.message;
    }
    throw new BadRequestException({ message: "Hay datos inválidos", errors });
  }
}

export const ZodBody = (schema: ZodType) => Body(new ZodPipe(schema));
export const ZodQuery = (schema: ZodType) => Query(new ZodPipe(schema));
