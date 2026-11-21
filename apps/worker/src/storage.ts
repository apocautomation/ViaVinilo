import { mkdir, open, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";

/** Almacenamiento de archivos de órdenes. En la E1 es disco local del VPS; después puede ser S3. */
export interface FileStorage {
  put(key: string, content: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  /** Primeros bytes del archivo (para leer el tamaño de una imagen sin cargarla entera). */
  getHead(key: string, bytes: number): Promise<Buffer>;
  /** Borra el archivo. Si ya no existe, no falla. */
  remove(key: string): Promise<void>;
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

  async remove(key: string): Promise<void> {
    const path = resolve(this.root, key);
    if (!path.startsWith(this.root + sep)) throw new Error(`Clave de archivo inválida: ${key}`);
    await rm(path, { force: true });
  }
}
