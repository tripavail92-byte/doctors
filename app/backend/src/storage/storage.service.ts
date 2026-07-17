import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

export interface StoredObject {
  key: string;
  sizeBytes: number;
}

/**
 * Object storage behind a small interface. This dev implementation writes to a
 * local directory; production swaps in an S3 adapter (put + presigned GET URLs)
 * without any change to callers. Keys are opaque (a uuid) — callers never build
 * a filesystem path.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly dir = process.env.STORAGE_DIR || join(process.cwd(), 'uploads');

  async onModuleInit(): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
    this.logger.log(`Local object storage at ${this.dir}`);
  }

  async put(buffer: Buffer): Promise<StoredObject> {
    const key = randomUUID();
    await fs.writeFile(this.pathFor(key), buffer);
    return { key, sizeBytes: buffer.length };
  }

  async readBuffer(key: string): Promise<Buffer> {
    return fs.readFile(this.pathFor(key));
  }

  // Resolve a key to a path, rejecting anything that could traverse the dir.
  private pathFor(key: string): string {
    if (key.includes('/') || key.includes('\\') || key.includes('..')) {
      throw new Error('Invalid storage key');
    }
    return join(this.dir, key);
  }
}
