import { createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import type { Readable } from "node:stream";
import { Injectable, NotFoundException } from "@nestjs/common";

/**
 * Archivos en el disco del VPS (D-062), en el mismo volumen que usa el worker para los adjuntos de
 * los mails (STORAGE_DIR, en producción /app/storage). Nunca se sale de esa carpeta.
 */
@Injectable()
export class StorageService {
  private readonly root = resolve(process.env.STORAGE_DIR?.trim() || "./storage");

  private path(key: string): string {
    const path = resolve(this.root, key);
    if (!path.startsWith(this.root + sep)) throw new NotFoundException("Archivo inválido");
    return path;
  }

  async put(key: string, content: Buffer): Promise<void> {
    const path = this.path(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content);
  }

  async open(key: string): Promise<{ stream: Readable; size: number }> {
    const path = this.path(key);
    const info = await stat(path).catch(() => null);
    if (!info?.isFile()) throw new NotFoundException("El archivo ya no está disponible");
    return { stream: createReadStream(path), size: info.size };
  }
}
