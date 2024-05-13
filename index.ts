/**
 * Serializer interface for parsing and stringifying values.
 */
export type Serializer = {
  /** Parses a string value into a generic type */
  parse<T = unknown>(value: string): T;
  /** Stringifies a generic value into a string */
  stringify<T = unknown>(value: T): string;
};

/**
 * Adapter interface for interacting with a synchronous storage system.
 * @template SetConfig - Optional configuration type for the setItem method.
 */
export type Adapter<SetConfig = unknown> = {
  /** (optional) Clears all items from the storage */
  clear?(): void;
  /** Retrieves an item from storage */
  getItem(key: string): string | null;
  /** Removes an item from storage */
  removeItem(key: string): void;
  /** Sets an item in storage with optional config */
  setItem(key: string, value: string): void;
  setItem(key: string, value: string, config?: SetConfig): void;
};

/**
 * Adapter interface for interacting with an asynchronous storage system.
 * @template SetConfig - Optional configuration type for the setItem method.
 */
export type AsyncAdapter<SetConfig = unknown> = {
  /** (optional) Clears all items from the storage */
  clear?(): Promise<void>;
  /** Retrieves an item from storage */
  getItem(key: string): Promise<string | null>;
  /** Removes an item from storage */
  removeItem(key: string): Promise<void>;
  /** Sets an item in storage with optional config */
  setItem(key: string, value: string): Promise<void>;
  setItem(key: string, value: string, config?: SetConfig): Promise<void>;
};

/**
 * Configuration options for synchronous storage.
 */
export type StorageConfig = {
  /**
   * (optional) Adapter for interacting with storage.
   * @default MemoryStorageAdapter
   */
  adapter?: Adapter;
  /**
   * (optional) Prefix for all storage keys.
   * @default ""
   */
  prefix?: string;
  /**
   * (optional) Serializer for parsing and stringifying values.
   * @default JSON
   */
  serializer?: Serializer;
};

export type AsyncStorageConfig = {
  /**
   * AsyncAdapter for interacting with storage.
   * @default MemoryStorageAdapter
   */
  adapter: AsyncAdapter;
  /**
   * (optional) Prefix for all storage keys.
   * @default ""
   */
  prefix?: string;
  /**
   * (optional) Serializer for parsing and stringifying values.
   * @default JSON
   */
  serializer?: Serializer;
};

/**
 * Response object for a defined storage key.
 * @template SetConfig - Optional configuration type for the set method.
 */
export type DefineResponse<SetConfig = unknown> = {
  get<T = unknown>(): T | null;
  set(value: unknown, config?: SetConfig): boolean;
  remove(): void;
  pop<T = unknown>(): T | null;
};

/**
 * Response object for a defined asynchronous storage key.
 * @template SetConfig - Optional configuration type for the set method.
 */
export type AsyncDefineResponse<SetConfig = unknown> = {
  get<T = unknown>(): Promise<T | null>;
  /** Retrieves the value from storage and removes it. */
  pop<T = unknown>(): Promise<T | null>;
  set(value: unknown, config?: SetConfig): Promise<boolean>;
  remove(): Promise<void>;
};

/**
 * Abstract base class for browser storage implementations.
 * @template SetConfig - Optional configuration type for the setItem method.
 */
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

/**
 * Synchronous browser storage class.
 * @template SetConfig - Optional configuration type for the setItem method.
 */
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

  clear(): void {
    this.adapter.clear?.();
  }

  pop<T>(key: string): T | null {
    const item = this.fromStore<T>(this.adapter.getItem(this.prefix + key));
    this.remove(key);
    return item;
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
      pop: <T = DefinedType>(): T | null => this.pop<T>(key),
    };
  }
}

/**
 * Asynchronous browser storage class with in memory cached storage.
 * @template SetConfig - Optional configuration object for the setItem method.
 */
export class AsyncBrowserStorage<SetConfig = unknown> extends AbstractBrowserStorage<SetConfig> {
  readonly adapter: AsyncAdapter<SetConfig>;
  readonly cachedAdapter: MemoryStorageAdapter = new MemoryStorageAdapter();
  readonly prefix: string;
  readonly serializer: Serializer;

  constructor(config: AsyncStorageConfig) {
    super();
    this.adapter = config.adapter;
    this.prefix = config.prefix ?? "";
    this.serializer = config.serializer ?? JSON;
  }

  async syncCache(): Promise<void> {
    for (let [key, value] of this.cachedAdapter.entries()) {
      await this.adapter.setItem(key, value);
    }
  }

  getCache(key: string): string | null {
    return this.cachedAdapter.getItem(key);
  }

  setCache(key: string, value?: string): void {
    if (value) this.cachedAdapter.setItem(key, value);
  }

  removeCache(key: string): void {
    this.cachedAdapter.removeItem(key);
  }

  async clear(): Promise<void> {
    await this.adapter.clear?.();
  }

  async get<T>(key: string): Promise<T | null> {
    return this.fromStore<T>(await this.adapter.getItem(this.prefix + key));
  }

  async pop<T>(key: string): Promise<T | null> {
    const item = await this.get<T>(key);
    await this.remove(key);
    return item;
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
      pop: <T = DefinedType>(): Promise<T | null> => this.pop<T>(key),
    };
  }
}

/**
 * Local storage class that extends BrowserStorage.
 * Uses localStorage if available, otherwise falls back to in-memory storage.
 */
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

/**
 * Session storage class that extends BrowserStorage.
 * Uses sessionStorage if available, otherwise falls back to in-memory storage.
 */
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

/** In-memory storage adapter implementing the Adapter interface. */
export class MemoryStorageAdapter implements Adapter {
  private storage = new Map<string, string>();

  entries(): IterableIterator<[string, string]> {
    return this.storage.entries();
  }

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
