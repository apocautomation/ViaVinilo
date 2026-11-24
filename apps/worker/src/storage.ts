import { createHash } from "node:crypto";
import { once } from "node:events";
import { createWriteStream } from "node:fs";
import { mkdir, open, readFile, rm, statfs, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";

/** Almacenamiento de archivos de órdenes. En la E1 es disco local del VPS; después puede ser S3. */
export interface FileStorage {
  put(key: string, content: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  /** Primeros bytes del archivo (para leer el tamaño de una imagen sin cargarla entera). */
  getHead(key: string, bytes: number): Promise<Buffer>;
  /** Borra el archivo. Si ya no existe, no falla. */
  remove(key: string): Promise<void>;
  /**
   * Escribe el archivo de a pedazos, sin cargarlo en memoria (D-076). Si pasa `maxBytes` corta, borra
   * lo que escribió y falla con `StorageFullError`.
   */
  putStream(key: string, body: ReadableStream<Uint8Array>, opts?: { maxBytes?: number }): Promise<{ size: number; checksum: string }>;
  /** Espacio libre en el disco donde se guardan los archivos, en bytes. */
  freeBytes(): Promise<number>;
}

/** No hay lugar en el disco para terminar de guardar el archivo. */
export class StorageFullError extends Error {
  constructor() {
    super("No hay espacio en el disco para guardar el archivo");
  }
}

export class LocalDiskStorage implements FileStorage {
  private readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  async put(key: string, content: Buffer): Promise<void> {
    const path = resolve(this.root, key);
    if (!path.startsWith(this.root + sep)) throw new Error(`Clave de archivo inválida: ${key}`);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content);
  }

  async get(key: string): Promise<Buffer> {
    const path = resolve(this.root, key);
    if (!path.startsWith(this.root + sep)) throw new Error(`Clave de archivo inválida: ${key}`);
    return readFile(path);
  }

  async getHead(key: string, bytes: number): Promise<Buffer> {
    const path = resolve(this.root, key);
    if (!path.startsWith(this.root + sep)) throw new Error(`Clave de archivo inválida: ${key}`);
    const handle = await open(path, "r");
    try {
      const buffer = Buffer.alloc(bytes);
      const { bytesRead } = await handle.read(buffer, 0, bytes, 0);
      return buffer.subarray(0, bytesRead);
    } finally {
      await handle.close();
    }
  }

  async putStream(key: string, body: ReadableStream<Uint8Array>, opts: { maxBytes?: number } = {}): Promise<{ size: number; checksum: string }> {
    const path = resolve(this.root, key);
    if (!path.startsWith(this.root + sep)) throw new Error(`Clave de archivo inválida: ${key}`);
    await mkdir(dirname(path), { recursive: true });
    const out = createWriteStream(path);
    const hash = createHash("sha256");
    const reader = body.getReader();
    let size = 0;
    // Un solo aviso de error para toda la escritura: sin esto, un error del disco fuera de una espera tira el worker.
    let failed: Error | null = null;
    out.on("error", (err) => (failed = err));
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (opts.maxBytes !== undefined && size > opts.maxBytes) throw new StorageFullError();
        hash.update(value);
        // Si el disco va más lento que la red, se espera: así no se acumula en memoria.
        // `once` saca sus avisos al terminar: antes quedaba uno colgado por cada espera.
        if (!out.write(value)) await once(out, "drain");
        if (failed) throw failed;
      }
      await new Promise<void>((ok, fail) => out.end((err?: Error | null) => (err ? fail(err) : ok())));
      return { size, checksum: hash.digest("hex") };
    } catch (err) {
      await reader.cancel().catch(() => undefined);
      out.destroy();
      await rm(path, { force: true });
      throw err;
    }
  }

  async freeBytes(): Promise<number> {
    await mkdir(this.root, { recursive: true });
    const s = await statfs(this.root);
    return Number(s.bavail) * Number(s.bsize);
  }

  async remove(key: string): Promise<void> {
    const path = resolve(this.root, key);
    if (!path.startsWith(this.root + sep)) throw new Error(`Clave de archivo inválida: ${key}`);
    await rm(path, { force: true });
  }
}
