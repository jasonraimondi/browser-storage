export type Serializer = {
  parse<T = unknown>(value: string): T;
  stringify<T = unknown>(value: T): string;
};

/**
 * @deprecated use Serializer instead
 */
export type StorageSerializer = Serializer;

export type Adapter = {
  clear?(): void;
  getItem(key: string): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
  setItem(key: string, value: string, config?: unknown): void;
};

export type StorageConfig = {
  prefix?: string;
  serializer?: Serializer;
  adapter?: Adapter;
};

export class BrowserStorage {
  readonly adapter: Adapter;
  readonly prefix: string;
  readonly serializer: Serializer;

  constructor(config: StorageConfig = {}) {
    this.adapter = config.adapter ?? new MemoryStorageAdapter();
    this.prefix = config.prefix ?? "";
    this.serializer = config.serializer ?? JSON;
  }

  clear() {
    this.adapter.clear?.();
  }

  get<T>(key: string): T | null {
    return this.fromStore<T>(this.adapter.getItem(this.prefix + key));
  }

  set(key: string, value?: unknown, config?: unknown): boolean {
    try {
      this.adapter.setItem(this.prefix + key, this.toStore(value), config);
      return true;
    } catch {
    }
    return false;
  }

  remove(key: string): void {
    this.adapter.removeItem(this.prefix + key);
  }

  defineGroup<GenericRecord extends Record<string, string>>(group: GenericRecord) {
    return Object
      .keys(group)
      .reduce((prev, next) => ({
        ...prev,
        [next]: this.define<string>(group[next]),
      }), {} as Record<keyof GenericRecord, ReturnType<BrowserStorage["define"]>>);
  }

  define<DefinedType>(key: string, config?: unknown) {
    return {
      get: <T = DefinedType>(): T | null => this.get<T>(key),
      set: (value: unknown, innerConfig?: unknown) => this.set(key, value, innerConfig ?? config),
      remove: () => this.remove(key),
    };
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
    } catch (e) {
    }

    return (item as T) ?? null;
  }
}

export class LocalStorage extends BrowserStorage {
  constructor(config: Omit<StorageConfig, "adapter"> = {}) {
    let adapter: Adapter = window.localStorage;
    if (!(adapter instanceof Storage)) {
      adapter = new MemoryStorageAdapter();
      console.log(
        "[@jmondi/browser-storage] window.localStorage is unavailable, falling back to an in memory storage adapter",
      );
    }
    super({ ...config, adapter });
  }
}

export class SessionStorage extends BrowserStorage {
  constructor(config: Omit<StorageConfig, "adapter"> = {}) {
    let adapter: Adapter = window.sessionStorage;
    if (!(adapter instanceof Storage)) {
      adapter = new MemoryStorageAdapter();
      console.log(
        "[@jmondi/browser-storage] window.sessionStorage is unavailable, falling back to an in memory storage adapter",
      );
    }
    super({ ...config, adapter });
  }
}

export class MemoryStorageAdapter implements Adapter {
  private storage = new Map<string, string | null>();

  clear(): void {
    this.storage.clear();
  }

  getItem(key: string): string | null {
    return this.storage.get(key) ?? null;
  }

  removeItem(key: string): void {
    this.storage.delete(key);
  }

  setItem(key: string, value: string): void {
    this.storage.set(key, value);
  }
}

/**
 * @deprecated use MemoryStorageAdapter instead
 */
export class MemoryStorageProvider extends MemoryStorageAdapter {
  constructor() {
    super();
    console.log(
      "[@jmondi/browser-storage] MemoryStorageProvider is deprecated, use MemoryStorageAdapter instead",
    );
  }
}
