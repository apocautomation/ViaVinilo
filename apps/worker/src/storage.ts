import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";

/** Almacenamiento de archivos de órdenes. En la E1 es disco local del VPS; después puede ser S3. */
export interface FileStorage {
  put(key: string, content: Buffer): Promise<void>;
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
}
