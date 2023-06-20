export interface StorageSerializer {
  parse<T = unknown>(value: string): T;
  stringify<T = unknown>(value: T): string;
}

export type StorageConfig = {
  prefix?: string;
  serializer?: StorageSerializer;
};

export class MemoryStorageProvider implements Storage {
  private storage = new Map<string, string | null>();

  clear(): void {
    this.storage.clear();
  }

  getItem(key: string): string | null {
    return this.storage.get(key) ?? null;
  }

  key(_: number): string | null {
    return null;
  }

  removeItem(key: string): void {
    this.storage.delete(key);
  }

  setItem(key: string, value: string): void {
    this.storage.set(key, value);
  }

  get length() {
    return this.storage.size;
  }
}

export abstract class AbstractStorage {
  readonly adapter: Storage = new MemoryStorageProvider();

  readonly prefix: string;
  readonly serializer: StorageSerializer;

  constructor({ prefix = "", serializer = JSON }: StorageConfig = {}) {
    this.prefix = prefix;
    this.serializer = serializer;
  }

  get<T>(key: string): T | null {
    return this.fromStore<T>(this.adapter.getItem(this.prefix + key));
  }

  set(key: string, value?: unknown): boolean {
    try {
      this.adapter.setItem(this.prefix + key, this.toStore(value));
      return true;
    } catch (e) {}
    return false;
  }

  remove(key: string) {
    this.adapter.removeItem(this.prefix + key);
  }

  clear(): void {
    this.adapter.clear();
  }

  private toStore(value: unknown): string {
    switch (typeof value) {
      case "string":
        return value;
      case "undefined":
        return this.serializer.stringify(null);
      default:
        return this.serializer.stringify(value);
    }
  }

  private fromStore<T = unknown>(item: unknown): T | null {
    if (item === "null") return null;
    if (typeof item !== "string") return null;

    try {
      return this.serializer.parse(item);
    } catch (e) {}

    return (item as T) ?? null;
  }
}

export class LocalStorage extends AbstractStorage {
  readonly adapter = window.localStorage;
}

export class SessionStorage extends AbstractStorage {
  readonly adapter = window.sessionStorage;
}
