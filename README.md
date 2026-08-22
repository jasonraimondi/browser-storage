# @jmondi/browser-storage

Typed, prefixed, serialized access to `localStorage`, `sessionStorage`, memory, or any custom adapter. No dependencies. Published on JSR only.

[![JSR](https://jsr.io/badges/@jmondi/browser-storage)](https://jsr.io/@jmondi/browser-storage)
[![JSR Score](https://jsr.io/badges/@jmondi/browser-storage/score)](https://jsr.io/@jmondi/browser-storage)
[![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/jasonraimondi/browser-storage/test.yml?branch=main&label=Unit%20Tests&style=flat-square)](https://github.com/jasonraimondi/browser-storage)

```ts
import { LocalStorage } from "@jmondi/browser-storage";

const storage = new LocalStorage({ prefix: "app__" });

const KEYS = storage.defineGroup<{ token: string; user: { email: string } }>({
  token: "jti",
  user: "u",
});

KEYS.token.set("abc"); // writes "app__jti"
KEYS.user.set({ email: "jason@example.com" }); // writes "app__u"
KEYS.user.get(); // { email: "jason@example.com" }
```

**Contents**

- [Tutorial: store your first typed value](#tutorial-store-your-first-typed-value)
- [How-to guides](#how-to-guides)
- [Reference](#reference)
- [Explanation](#explanation)

---

## Tutorial: store your first typed value

In this tutorial you install the package, write a typed object to `localStorage`, read it back, and remove it. You need a TypeScript project that runs in a browser or in Deno. No prior experience with this library is necessary.

### 1. Install

```bash
deno add jsr:@jmondi/browser-storage   # Deno
npx jsr add @jmondi/browser-storage    # Node or a bundler
bunx jsr add @jmondi/browser-storage   # Bun
```

### 2. Create a storage

```ts
import { LocalStorage } from "@jmondi/browser-storage";

const storage = new LocalStorage({ prefix: "app__" });
```

`LocalStorage` uses `window.localStorage` when it is writable. If it is not writable, the storage falls back to memory and logs one message to the console.

### 3. Define a typed key and write to it

```ts
type User = { email: string };

const USER = storage.define<User>("user");

const ok = USER.set({ email: "jason@example.com" });
console.log(ok); // true
```

Open DevTools → Application → Local Storage. You see the key `app__user` with the value `{"email":"jason@example.com"}`.

### 4. Read the value

```ts
const user = USER.get();
console.log(user?.email); // "jason@example.com"
```

The value comes back as a `User | null`, not as a string. The library parses it for you.

### 5. Remove the value

```ts
USER.remove();
console.log(USER.get()); // null
```

The key `app__user` is gone from DevTools.

### 6. Try a type error

```ts
USER.set("not a user"); // TypeScript error: string is not assignable to User
```

The compiler stops the mistake before it reaches storage.

You now have typed, prefixed access to `localStorage`. Continue with the [how-to guides](#how-to-guides) for groups, custom adapters, and migration.

---

## How-to guides

Each guide solves one task. The guides assume you completed the tutorial.

### How to group related keys

Use `defineGroup` when several keys belong together. Give it a type map; each property becomes a typed handle.

```ts
const AUTH = storage.defineGroup<{
  token: string;
  refresh: string;
  user: { id: number; email: string };
}>({
  token: "access_token",
  refresh: "refresh_token",
  user: "current_user",
});

AUTH.token.set("abc");
AUTH.user.get(); // { id, email } | null
AUTH.refresh.pop(); // returns the value and removes it
AUTH.user.key; // "app__current_user"
```

### How to use `sessionStorage`

Replace `LocalStorage` with `SessionStorage`. The API is identical.

```ts
import { SessionStorage } from "@jmondi/browser-storage";

const storage = new SessionStorage({ prefix: "app__" });
```

### How to use an in-memory store (tests, SSR)

Construct `BrowserStorage` with no adapter. It defaults to `MemoryStorageAdapter`.

```ts
import { BrowserStorage } from "@jmondi/browser-storage";

const storage = new BrowserStorage({ prefix: "test__" });
```

`BrowserStorage` never touches `globalThis.localStorage`, so it is safe to construct in any runtime.

### How to write a custom synchronous adapter

Implement `getItem`, `setItem`, and `removeItem`. Add `length` and `key(index)` if you need `clear()` with a prefix.

```ts
import { BrowserStorage, type Adapter } from "@jmondi/browser-storage";

const map = new Map<string, string>();

const adapter: Adapter = {
  getItem: (k) => map.get(k) ?? null,
  setItem: (k, v) => void map.set(k, v),
  removeItem: (k) => void map.delete(k),
  get length() {
    return map.size;
  },
  key: (i) => [...map.keys()][i] ?? null,
};

const storage = new BrowserStorage({ adapter, prefix: "app__" });
```

### How to write an asynchronous adapter

Implement the same three methods as promises. Add `keys()` if you need `clear()` with a prefix. Pass the adapter to `AsyncBrowserStorage`; this class has no default adapter.

```ts
import { AsyncBrowserStorage, type AsyncAdapter } from "@jmondi/browser-storage";

const adapter: AsyncAdapter = {
  getItem: (k) => api.get(k),
  setItem: (k, v) => api.put(k, v),
  removeItem: (k) => api.delete(k),
  keys: () => api.list(),
};

const storage = new AsyncBrowserStorage({ adapter, prefix: "app__" });

await storage.set("token", "abc");
await storage.get<string>("token");
```

Every method on `AsyncBrowserStorage` returns a promise, including the handles from `define` and `defineGroup`.

### How to pass options to `setItem`

Some adapters accept a third argument on `setItem`, for example cookie options. Type the adapter with `Adapter<YourOptions>` and pass the options on `set`. A default can go on `define`.

```ts
type CookieOptions = { maxAge?: number };

const storage = new BrowserStorage<CookieOptions>({ adapter: cookieAdapter });

storage.set("token", "abc", { maxAge: 3600 });

const TOKEN = storage.define<string>("token", { maxAge: 3600 });
TOKEN.set("abc"); // uses maxAge 3600
TOKEN.set("abc", { maxAge: 60 }); // overrides
```

### How to store strings without JSON encoding

The default serializer is `JSON`, so the string `"12345"` is stored as `"\"12345\""`. If you need raw strings, or if you read keys that other code wrote as raw strings, use `RawStringSerializer`.

```ts
import { LocalStorage, RawStringSerializer } from "@jmondi/browser-storage";

const storage = new LocalStorage({ serializer: RawStringSerializer });

storage.set("flag", "true"); // stores the literal true
storage.get<string>("flag"); // "true" (a string, not a boolean)
storage.set("flag", true); // false: non-strings are rejected
```

### How to use a custom serializer

Provide an object with `parse` and `stringify`.

```ts
import superjson from "superjson";

const storage = new LocalStorage({ serializer: superjson });
```

If `parse` throws during `get`, the raw stored string is returned. See [What happens when parsing fails](#what-happens-when-parsing-fails).

### How to migrate keys from an older key scheme

Pass `migrate` in the config. Each entry copies a legacy key to its new prefixed key one time, then removes the legacy key.

```ts
const storage = new LocalStorage({
  prefix: "app__",
  migrate: [
    "token", // "token" → "app__token"
    { from: "orgId", to: "organizationId" }, // "orgId" → "app__organizationId"
    { from: "theme", to: "theme", cleanup: false }, // copy, keep "theme"
  ],
});
```

Rules:

- `from` is the exact legacy key. The prefix is not added to it.
- The prefix is added to `to`.
- If the new key already has a value, the entry is skipped and the legacy key stays.
- If the legacy key is absent, nothing happens.
- If the write fails, the legacy key stays.

`LocalStorage` and `BrowserStorage` migrate in the constructor. `AsyncBrowserStorage` migrates one time before its first `get`, `set`, `remove`, or `clear`. Call `await storage.ready()` to migrate earlier.

To migrate without constructing a storage, call `migrateLegacyKeys` or `migrateLegacyKeysAsync` directly. These functions do not add a prefix; pass fully resolved `to` keys.

```ts
import { migrateLegacyKeys } from "@jmondi/browser-storage";

migrateLegacyKeys(localStorage, [{ from: "token", to: "app__token" }]);
```

### How to clear only your keys

Call `clear()` on a storage that has a prefix. Only keys that start with the prefix are removed.

```ts
const storage = new LocalStorage({ prefix: "app__" });
storage.clear(); // removes app__*, keeps everything else
```

With an empty prefix, `clear()` calls the adapter's `clear()` and removes every key in the store.

With a prefix, the adapter must support enumeration (`length` and `key(index)` for sync, `keys()` for async) or `clear()` throws.

### How to check that a write succeeded

`set` returns `false` instead of throwing. Check the return value.

```ts
if (!USER.set(user)) {
  // quota exceeded, storage blocked, or serializer rejected the value
}
```

---

## Reference

### Classes

#### `LocalStorage`

```ts
new LocalStorage(config?: Omit<StorageConfig, "adapter">)
```

`BrowserStorage` bound to `window.localStorage`. Probes the store with a write before use. Falls back to `MemoryStorageAdapter` and logs `[@jmondi/browser-storage] localStorage is unavailable, falling back to an in memory storage` when the probe fails.

#### `SessionStorage`

```ts
new SessionStorage(config?: Omit<StorageConfig, "adapter">)
```

Same as `LocalStorage` for `window.sessionStorage`.

#### `BrowserStorage<SetConfig = unknown>`

```ts
new BrowserStorage<SetConfig>(config?: StorageConfig)
```

Synchronous storage over an `Adapter`. Runs `migrate` entries in the constructor.

| Member | Signature | Notes |
|---|---|---|
| `get` | `get<T>(key: string): T \| null` | `null` if absent. |
| `set` | `set(key: string, value?: unknown, config?: SetConfig): boolean` | `undefined` is stored as `null`. Returns `false` on any error. |
| `remove` | `remove(key: string): void` | |
| `pop` | `pop<T>(key: string): T \| null` | `get` then `remove`. |
| `clear` | `clear(): void` | Prefix-scoped. Throws if prefix is set and the adapter lacks `length` or `key`. |
| `define` | `define<T>(key: string, defaultConfig?: SetConfig): DefineResponse<T, SetConfig>` | |
| `defineGroup` | `defineGroup<TypeMap>(group: { [K in keyof TypeMap]: string }): { [K in keyof TypeMap]: DefineResponse<TypeMap[K], SetConfig> }` | |
| `adapter` | `Adapter<SetConfig>` | readonly |
| `prefix` | `string` | readonly |
| `serializer` | `Serializer` | readonly |

#### `AsyncBrowserStorage<SetConfig = unknown>`

```ts
new AsyncBrowserStorage<SetConfig>(config: AsyncStorageConfig)
```

Asynchronous storage over an `AsyncAdapter`. `adapter` is required. Runs `migrate` entries one time before the first adapter call.

| Member | Signature | Notes |
|---|---|---|
| `ready` | `ready(): Promise<void>` | Runs migration one time. Called by all other methods. |
| `get` | `get<T>(key: string): Promise<T \| null>` | |
| `set` | `set(key: string, value?: unknown, config?: SetConfig): Promise<boolean>` | Resolves `false` on any error. |
| `remove` | `remove(key: string): Promise<void>` | |
| `pop` | `pop<T>(key: string): Promise<T \| null>` | |
| `clear` | `clear(): Promise<void>` | Prefix-scoped. Throws if prefix is set and the adapter lacks `keys()`. Does not clear the cache. |
| `define` | `define<T>(key: string, defaultConfig?: SetConfig): AsyncDefineResponse<T, SetConfig>` | |
| `defineGroup` | `defineGroup<TypeMap>(group): { [K in keyof TypeMap]: AsyncDefineResponse<TypeMap[K], SetConfig> }` | |
| `getCache` | `getCache(key: string): string \| null` | Synchronous read from the local cache. Raw string, not parsed. |
| `setCache` | `setCache(key: string, value: string): void` | Synchronous write to the local cache only. |
| `removeCache` | `removeCache(key: string): void` | |
| `syncCache` | `syncCache(): Promise<void>` | Writes every cache entry to the adapter. |
| `cachedAdapter` | `MemoryStorageAdapter` | readonly |

The cache is independent of `get` and `set`. `get` reads the adapter only; `set` writes the adapter only.

#### `MemoryStorageAdapter`

```ts
new MemoryStorageAdapter()
```

`Map`-backed `Adapter`. Implements `getItem`, `setItem`, `removeItem`, `clear`, `length`, `key(index)`, and `entries()`. Default adapter for `BrowserStorage`.

### Handles

#### `DefineResponse<T, SetConfig>`

| Member | Signature |
|---|---|
| `get` | `get(): T \| null` |
| `set` | `set(value: T, config?: SetConfig): boolean` |
| `remove` | `remove(): void` |
| `pop` | `pop(): T \| null` |
| `key` | `string` — the prefixed key |

#### `AsyncDefineResponse<T, SetConfig>`

Same members. Every method returns a `Promise`.

### Config

#### `StorageConfig`

| Field | Type | Default |
|---|---|---|
| `adapter` | `Adapter` | `new MemoryStorageAdapter()` |
| `prefix` | `string` | `""` |
| `serializer` | `Serializer` | `JSON` |
| `migrate` | `MigrateConfig` | `[]` |

#### `AsyncStorageConfig`

| Field | Type | Default |
|---|---|---|
| `adapter` | `AsyncAdapter` | required |
| `prefix` | `string` | `""` |
| `serializer` | `Serializer` | `JSON` |
| `migrate` | `MigrateConfig` | `[]` |

#### `MigrateConfig`

```ts
type MigrateConfig = (string | LegacyKeyMigration)[];
```

A string `k` is shorthand for `{ from: k, to: k }`.

#### `LegacyKeyMigration`

| Field | Type | Default | Description |
|---|---|---|---|
| `from` | `string` | | Legacy key exactly as stored. No prefix is added. |
| `to` | `string` | | New key. The prefix is added when used in `migrate`; not added in the standalone functions. |
| `cleanup` | `boolean` | `true` | Remove `from` after a successful copy. |

### Contracts

#### `Adapter<SetConfig = unknown>`

| Member | Signature | Required |
|---|---|---|
| `getItem` | `(key: string) => string \| null` | yes |
| `setItem` | `(key: string, value: string, config?: SetConfig) => void` | yes |
| `removeItem` | `(key: string) => void` | yes |
| `clear` | `() => void` | no; used by `clear()` with an empty prefix |
| `length` | `number` | no; needed with `key` for prefixed `clear()` |
| `key` | `(index: number) => string \| null` | no; needed with `length` for prefixed `clear()` |

Native `Storage` objects satisfy this contract.

#### `AsyncAdapter<SetConfig = unknown>`

| Member | Signature | Required |
|---|---|---|
| `getItem` | `(key: string) => Promise<string \| null>` | yes |
| `setItem` | `(key: string, value: string, config?: SetConfig) => Promise<void>` | yes |
| `removeItem` | `(key: string) => Promise<void>` | yes |
| `clear` | `() => Promise<void>` | no; used by `clear()` with an empty prefix |
| `keys` | `() => Promise<string[]>` | no; needed for prefixed `clear()` |

#### `Serializer`

```ts
type Serializer = {
  parse<T = unknown>(value: string): T;
  stringify<T = unknown>(value: T): string;
};
```

The global `JSON` satisfies this contract.

### Serializers

#### `RawStringSerializer`

`parse` returns the input unchanged. `stringify` returns the input unchanged when it is a string and throws `TypeError` otherwise. Through `set`, the throw becomes a `false` return.

### Functions

#### `migrateLegacyKeys`

```ts
migrateLegacyKeys(adapter: Adapter, migrations: LegacyKeyMigration[]): void
```

For each migration: skip if `to` has a value; skip if `from` is absent; copy `from` to `to`; on write error, continue; if `cleanup` is not `false`, remove `from`. Idempotent. No prefix is applied.

#### `migrateLegacyKeysAsync`

```ts
migrateLegacyKeysAsync(adapter: AsyncAdapter, migrations: LegacyKeyMigration[]): Promise<void>
```

Same rules with awaited adapter calls.

### Behavior summary

| Situation | Result |
|---|---|
| `set(key)` with no value | stores `null` |
| `set` throws in adapter or serializer | returns `false`, nothing written |
| `get` on a missing key | `null` |
| `get` when `serializer.parse` throws | the raw stored string |
| `clear()` with empty prefix | `adapter.clear?.()` |
| `clear()` with prefix, adapter can enumerate | removes keys that start with prefix |
| `clear()` with prefix, adapter cannot enumerate | throws `Error` |
| `localStorage` unavailable or not writable | `MemoryStorageAdapter` plus one console message |

---

## Explanation

### Why this library exists

Web Storage is a flat bag of strings on a shared origin. Three problems appear in every project that uses it directly:

1. Every call site must `JSON.stringify` and `JSON.parse` by hand, and the types are lost.
2. `localStorage` can be present but throw on write: sandboxed iframes, blocked cookies, old Safari private mode.
3. Keys from different features and libraries collide, and there is no clean way to rename a key after users already have data.

This library adds a small layer that solves each problem: symmetric serialization with types, a write probe with a memory fallback, and a prefix with one-time key migration.

### How the pieces fit together

Three concerns are separated so you can replace each one alone:

- The **adapter** moves strings in and out of a store. The native `Storage` object, a `Map`, a cookie jar, or a remote API all fit the same three methods.
- The **serializer** turns values into strings and back. `JSON` is the default.
- The **storage** (`BrowserStorage` or `AsyncBrowserStorage`) applies the prefix, calls the serializer on both sides of the adapter, and hands out typed **handles** through `define` and `defineGroup`.

A handle binds one key and one type. Call sites stop repeating string keys and stop casting the result.

### Why `set` returns a boolean

Writes to Web Storage fail for reasons outside the code's control: quota, blocked storage, a serializer that rejects the value. The library treats a failed write as a value, not as an exception, so callers check one boolean instead of wrapping every write in `try/catch`. Reads and removes do not fail the same way, so they keep a plain return.

### What happens when parsing fails

`get` runs the stored string through `serializer.parse`. If `parse` throws, `get` returns the raw string instead of throwing or returning `null`. This lets a key written by older code, or by a different library, read as a string with no crash. If you need a strict type, compare the result against `typeof` before you use it, or migrate the key with `RawStringSerializer`.

### Why `clear` is scoped to the prefix

A prefix exists so that several features share one origin without collisions. A `clear()` that wiped the whole origin would defeat that purpose. With a prefix, `clear()` enumerates keys and removes only the matching ones. This needs enumeration support from the adapter. When the adapter cannot enumerate, the library throws instead of silently removing nothing or removing everything, because both silent outcomes hide data loss.

### Why migration runs once up front

An earlier design copied a legacy key on the first read of the new key. That design had two faults. A `clear()` that ran before the first read could not see the legacy key, so the old value came back later. And every `get` became a possible write, which could throw on quota.

The current design migrates one time, before any other adapter call. Synchronous storages do it in the constructor. `AsyncBrowserStorage` does it behind a memoized promise that every method awaits, so concurrent calls share one migration. After that, `get` is read-only again.

Migration never overwrites an existing value at the new key. When the new key already has data, the entry is skipped and the legacy key stays. Migration is a one-way copy that protects the newest data.

### Why `RawStringSerializer` exists

Older versions of this library, and most hand-written code, wrote strings to storage verbatim. A value like `"12345"` or `"true"` sits in storage without quotes. The default `JSON` serializer parses that into a number or a boolean. `RawStringSerializer` skips encoding in both directions so those values stay strings. It rejects non-strings on write so the store never holds `"[object Object]"`.

### Why the memory adapter is the default

`BrowserStorage` defaults to `MemoryStorageAdapter` so that the class is safe to construct in tests, on a server, or in any runtime without Web Storage. `LocalStorage` and `SessionStorage` fall back to the same adapter when the write probe fails. In both cases the application keeps working; only persistence across page loads is lost, and the fallback logs one message so the condition is visible.

### Changes from v1 to v2

- **Symmetric serialization.** v1 wrote strings verbatim and parsed everything on read, so `"1234"` came back as `1234`. v2 runs every value through the serializer in both directions. Data written by v1 can read back with a different type; use `migrate` and `RawStringSerializer` to reconcile it.
- **Prefix-scoped `clear()`.** v1 cleared the whole store. v2 removes only prefixed keys and throws when the adapter cannot enumerate. Custom adapters need `length` and `key` (sync) or `keys()` (async).
- **Typed handles.** `DefineResponse<SetConfig>` became `DefineResponse<DefinedType, SetConfig>`. `defineGroup` takes a type map so each key has its own value type.
- **JSR only.** The npm package is no longer published. Install through JSR in every runtime.
