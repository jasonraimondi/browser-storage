export type Serializer = {
  parse<T = unknown>(value: string): T;
  stringify<T = unknown>(value: T): string;
};

/**
 * @deprecated use Serializer instead
 */
export type StorageSerializer = Serializer;

export type Adapter<SetConfig = unknown> = {
  clear?(): void;
  getItem(key: string): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
  setItem(key: string, value: string, config?: SetConfig): void;
};

export type AsyncAdapter<SetConfig = unknown> = {
  clear?(): Promise<void>;
  getItem(key: string): Promise<string | null>;
  removeItem(key: string): Promise<void>;
  setItem(key: string, value: string): Promise<void>;
  setItem(key: string, value: string, config?: SetConfig): Promise<void>;
};

export type StorageConfig = {
  prefix?: string;
  serializer?: Serializer;
  adapter?: Adapter;
};

export type AsyncStorageConfig = {
  prefix?: string;
  serializer?: Serializer;
  adapter?: AsyncAdapter;
};

export type DefineResponse<SetConfig = unknown> = {
  get<T = unknown>(): T | null;
  set(value: unknown, config?: SetConfig): boolean;
  remove(): void;
};

export type AsyncDefineResponse<SetConfig = unknown> = {
  get<T = unknown>(): Promise<T | null>;
  set(value: unknown, config?: SetConfig): Promise<boolean>;
  remove(): Promise<void>;
};

export abstract class AbstractBrowserStorage<SetConfig = unknown> {
  abstract adapter: Adapter<SetConfig> | AsyncAdapter<SetConfig>;
  abstract prefix: string;
  abstract serializer: Serializer;

  protected toStore(value: unknown): string {
    switch (typeof value) {
      case "string":
        return value;
      case "undefined":
        return this.serializer.stringify(null);
      default:
        return this.serializer.stringify(value);
    }
  }

  protected fromStore<T = unknown>(item: unknown): T | null {
    if (item === "null") return null;
    if (typeof item !== "string") return null;

    try {
      return this.serializer.parse(item);
    } catch (e) {
    }

    return (item as T) ?? null;
  }
}

export class BrowserStorage<SetConfig = unknown> extends AbstractBrowserStorage<SetConfig> {
  readonly adapter: Adapter<SetConfig>;
  readonly prefix: string;
  readonly serializer: Serializer;

  constructor(config: StorageConfig = {}) {
    super();
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

  set(key: string, value?: unknown, config?: SetConfig): boolean {
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

  defineGroup<GenericRecord extends Record<string, string>>(
    group: GenericRecord,
  ): Record<keyof GenericRecord, DefineResponse<SetConfig>> {
    return Object
      .keys(group)
      .reduce((prev, next) => ({
        ...prev,
        [next]: this.define<string>(group[next]),
      }), {} as Record<keyof GenericRecord, DefineResponse<SetConfig>>);
  }

  define<DefinedType>(key: string, defaultConfig?: SetConfig): DefineResponse<SetConfig> {
    return {
      get: <T = DefinedType>(): T | null => this.get<T>(key),
      set: (value: unknown, config?: SetConfig) => this.set(key, value, config ?? defaultConfig),
      remove: () => this.remove(key),
    };
  }
}

export class AsyncBrowserStorage<SetConfig = unknown> extends AbstractBrowserStorage<SetConfig> {
  readonly adapter: AsyncAdapter<SetConfig>;
  readonly prefix: string;
  readonly serializer: Serializer;

  constructor(config: StorageConfig & { adapter: AsyncAdapter<SetConfig> }) {
    super();
    this.adapter = config.adapter;
    this.prefix = config.prefix ?? "";
    this.serializer = config.serializer ?? JSON;
  }

  clear() {
    this.adapter.clear?.();
  }

  async get<T>(key: string): Promise<T | null> {
    return this.fromStore<T>(await this.adapter.getItem(this.prefix + key));
  }

  async set(key: string, value?: unknown, config?: SetConfig): Promise<boolean> {
    try {
      await this.adapter.setItem(this.prefix + key, this.toStore(value), config);
      return true;
    } catch {
    }
    return false;
  }

  async remove(key: string): Promise<void> {
    await this.adapter.removeItem(this.prefix + key);
  }

  defineGroup<GenericRecord extends Record<string, string>>(
    group: GenericRecord,
  ): Record<keyof GenericRecord, AsyncDefineResponse<SetConfig>> {
    return Object
      .keys(group)
      .reduce((prev, next) => ({
        ...prev,
        [next]: this.define<string>(group[next]),
      }), {} as Record<keyof GenericRecord, AsyncDefineResponse<SetConfig>>);
  }

  define<DefinedType>(key: string, defaultConfig?: SetConfig): AsyncDefineResponse<SetConfig> {
    return {
      get: <T = DefinedType>(): Promise<T | null> => this.get<T>(key),
      set: (value: unknown, config?: SetConfig) => this.set(key, value, config ?? defaultConfig),
      remove: () => this.remove(key),
    };
  }
}

export class LocalStorage extends BrowserStorage {
  constructor(config: Omit<StorageConfig, "adapter"> = {}) {
    let adapter: Adapter = new MemoryStorageAdapter();
    try {
      adapter = window.localStorage;
    } catch {
      console.log(
        "[@jmondi/browser-storage]",
        "localStorage is unavailable, falling back to an in memory storage",
      );
    }
    super({ ...config, adapter });
  }
}

export class SessionStorage extends BrowserStorage {
  constructor(config: Omit<StorageConfig, "adapter"> = {}) {
    let adapter: Adapter = new MemoryStorageAdapter();
    try {
      adapter = window.sessionStorage;
    } catch {
      console.log(
        "[@jmondi/browser-storage]",
        "sessionStorage is unavailable, falling back to in memory storage",
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
