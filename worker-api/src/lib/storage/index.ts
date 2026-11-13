import fs from "node:fs";
import path from "node:path";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export interface StorageFile {
  data: Uint8Array;
  contentType: string;
}

export interface StorageProvider {
  put(key: string, data: Uint8Array | Buffer, contentType?: string): Promise<void>;
  get(key: string): Promise<StorageFile | null>;
  delete(key: string): Promise<boolean>;
  has(key: string): Promise<boolean>;
}

export class MemoryStorageProvider implements StorageProvider {
  private files = new Map<string, StorageFile>();

  async put(key: string, data: Uint8Array | Buffer, contentType?: string): Promise<void> {
    this.files.set(key, {
      data: new Uint8Array(data),
      contentType: contentType || "application/octet-stream",
    });
  }

  async get(key: string): Promise<StorageFile | null> {
    return this.files.get(key) ?? null;
  }

  async delete(key: string): Promise<boolean> {
    return this.files.delete(key);
  }

  async has(key: string): Promise<boolean> {
    return this.files.has(key);
  }
}

export class LocalStorageProvider implements StorageProvider {
  private uploadDir: string;

  constructor(uploadDir?: string) {
    this.uploadDir =
      uploadDir ??
      process.env.UPLOAD_DIR ??
      path.join(process.cwd(), "static", "uploads");

    if (!fs.existsSync(this.uploadDir)) {
      try {
        fs.mkdirSync(this.uploadDir, { recursive: true });
      } catch {
        // May fail in restricted environments, handled on write
      }
    }
  }

  private getFilePath(key: string): string {
    const safeKey = path.basename(key);
    return path.join(this.uploadDir, safeKey);
  }

  private guessContentType(filename: string): string {
    const ext = filename.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "pdf":
        return "application/pdf";
      case "png":
        return "image/png";
      case "jpg":
      case "jpeg":
        return "image/jpeg";
      case "gif":
        return "image/gif";
      case "webp":
        return "image/webp";
      default:
        return "application/octet-stream";
    }
  }

  async put(key: string, data: Uint8Array | Buffer, contentType?: string): Promise<void> {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
    const filePath = this.getFilePath(key);
    await fs.promises.writeFile(filePath, Buffer.from(data));
  }

  async get(key: string): Promise<StorageFile | null> {
    const filePath = this.getFilePath(key);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const buf = await fs.promises.readFile(filePath);
    return {
      data: new Uint8Array(buf),
      contentType: this.guessContentType(key),
    };
  }

  async delete(key: string): Promise<boolean> {
    const filePath = this.getFilePath(key);
    if (!fs.existsSync(filePath)) {
      return false;
    }
    await fs.promises.unlink(filePath);
    return true;
  }

  async has(key: string): Promise<boolean> {
    const filePath = this.getFilePath(key);
    return fs.existsSync(filePath);
  }
}

export class R2StorageProvider implements StorageProvider {
  private bucket: R2Bucket;

  constructor(bucket: R2Bucket) {
    this.bucket = bucket;
  }

  async put(key: string, data: Uint8Array | Buffer, contentType?: string): Promise<void> {
    await this.bucket.put(key, data, {
      httpMetadata: {
        contentType: contentType ?? "application/octet-stream",
      },
    });
  }

  async get(key: string): Promise<StorageFile | null> {
    const obj = await this.bucket.get(key);
    if (!obj) {
      return null;
    }
    const arrayBuffer = await obj.arrayBuffer();
    return {
      data: new Uint8Array(arrayBuffer),
      contentType: obj.httpMetadata?.contentType ?? "application/octet-stream",
    };
  }

  async delete(key: string): Promise<boolean> {
    await this.bucket.delete(key);
    return true;
  }

  async has(key: string): Promise<boolean> {
    const head = await this.bucket.head(key);
    return head !== null;
  }
}

let activeStorageProvider: StorageProvider | undefined;

export function setStorageProvider(provider: StorageProvider | undefined): void {
  activeStorageProvider = provider;
}

export async function getStorageProvider(): Promise<StorageProvider> {
  if (activeStorageProvider) {
    return activeStorageProvider;
  }

  try {
    const ctx = await getCloudflareContext({ async: true });
    if (ctx?.env?.UPLOADS) {
      activeStorageProvider = new R2StorageProvider(ctx.env.UPLOADS);
      return activeStorageProvider;
    }
  } catch {
    // Not running inside a Cloudflare worker environment
  }

  activeStorageProvider = new LocalStorageProvider();
  return activeStorageProvider;
}
