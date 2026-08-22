# @jmondi/browser-storage

Typed, prefixed, serialized access to `localStorage`, `sessionStorage`, memory, or any storage you can adapt. Zero dependencies.

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

KEYS.token.set("abc");
KEYS.user.set({ email: "jason@example.com" });
KEYS.user.get(); // { email: "jason@example.com" }
```

- [Get started](#get-started)
- [How-to guides](#how-to-guides)
- [Reference](#reference)
- [Explanation](#explanation)
- [Upgrading to v2](#upgrading-to-v2)

## Get started

In this tutorial you will store a typed object in `localStorage`, read it back, and remove it. You need a browser project, or Deno, with TypeScript.

1. Install the package.

   ```bash
   npx jsr add @jmondi/browser-storage   # Node, Bun, or a bundler
   deno add jsr:@jmondi/browser-storage  # Deno
   ```

2. Create a storage with a prefix. The prefix keeps your keys apart from other code that shares the same origin.

   ```ts
   import { LocalStorage } from "@jmondi/browser-storage";

   const storage = new LocalStorage({ prefix: "app__" });
   ```

3. Define a typed key and write to it.

   ```ts
   type User = { email: string };
   const USER = storage.define<User>("user");

   USER.set({ email: "jason@example.com" }); // true
   ```

   Open DevTools → Application → Local Storage. You will see the key `app__user` with the value `{"email":"jason@example.com"}`.

4. Read it back. The value is parsed and typed.

   ```ts
   const user = USER.get(); // User | null
   user?.email; // "jason@example.com"
   ```

5. Remove it.

   ```ts
   USER.remove();
   USER.get(); // null
   ```

You now have a typed key that survives page reloads. To group many keys, continue with [Define a group of keys](#define-a-group-of-keys).

## How-to guides

Each guide solves one task. They assume you have read [Get started](#get-started).

### Define a group of keys

Pass a map of names to storage keys. Add a type map to give each key its own type.

```ts
const KEYS = storage.defineGroup<{ token: string; user: User }>({
  token: "jti",
  user: "u",
});

KEYS.token.key; // "app__jti"
KEYS.token.set("abc");
KEYS.token.get(); // string | null
KEYS.user.pop(); // returns User | null, then removes the key
```

### Use keys without defining them first

Call `get`, `set`, `remove`, and `pop` directly on the storage with any key string.

```ts
storage.set("draft", { body: "..." });
storage.get<{ body: string }>("draft");
storage.remove("draft");
```

### Keep data for the session only

Use `SessionStorage`. It has the same API as `LocalStorage`, but the browser clears it when the tab closes.

```ts
import { SessionStorage } from "@jmondi/browser-storage";

const session = new SessionStorage({ prefix: "app__" });
```

### Adopt a prefix on an app that already has keys in storage

When you add a `prefix`, keys that were written without it become invisible: `get("token")` now reads `app__token`. Pass `migrate` with the legacy key names. When the storage is constructed, each legacy key is copied to its prefixed key and then removed.

```ts
const storage = new LocalStorage({
  prefix: "app__",
  migrate: ["token", "orgId"],
});

storage.get("token"); // value that was stored under "token"
```

To rename a key at the same time, or to keep the legacy key, use the object form.

```ts
migrate: [
  { from: "orgId", to: "organizationId" },      // "orgId" → "app__organizationId"
  { from: "theme", to: "theme", cleanup: false }, // copy, but keep "theme"
]
```

A prefixed key that already has a value keeps it. If the write fails, for example on a full quota, the legacy key stays and the storage works as if it had no migration for that key.

### Keep legacy string values as strings

The default serializer is `JSON`. A legacy raw value such as `"12345"` or `"true"` is valid JSON, so `get()` returns the number `12345` or the boolean `true`. To keep such keys as strings, put them on a storage that uses `RawStringSerializer`.

```ts
import { LocalStorage, RawStringSerializer } from "@jmondi/browser-storage";

const ids = new LocalStorage({
  prefix: "app__",
  serializer: RawStringSerializer,
  migrate: ["orgId"],
});

ids.get("orgId"); // "12345"
ids.set("orgId", 42); // false: only strings are accepted
```

Values that are not valid JSON, such as a JWT, read back as strings with the default serializer too. See [Parse failures return the raw string](#parse-failures-return-the-raw-string).

### Migrate keys on an adapter directly

Use the standalone functions when you manage the adapter yourself. Here `to` is the full key, prefix included.

```ts
import { migrateLegacyKeys, migrateLegacyKeysAsync } from "@jmondi/browser-storage";

migrateLegacyKeys(localStorage, [{ from: "token", to: "app__token" }]);
await migrateLegacyKeysAsync(myAsyncAdapter, [{ from: "token", to: "app__token" }]);
```

Both functions are idempotent. Calling them again does nothing.

### Write a custom adapter

Implement `getItem`, `setItem`, and `removeItem`. The third `setItem` argument is an optional per-write config that you choose; pass its type to `BrowserStorage`.

```ts
import { type Adapter, BrowserStorage } from "@jmondi/browser-storage";
import Cookies from "js-cookie";

class CookieAdapter implements Adapter<Cookies.CookieAttributes> {
  getItem(key: string): string | null {
    return Cookies.get(key) ?? null;
  }
  setItem(key: string, value: string, config?: Cookies.CookieAttributes): void {
    Cookies.set(key, value, config);
  }
  removeItem(key: string): void {
    Cookies.remove(key);
  }
}

const cookies = new BrowserStorage<Cookies.CookieAttributes>({
  prefix: "app_",
  adapter: new CookieAdapter(),
});

cookies.set("consent", "yes", { expires: 365 });
```

To support `clear()` with a prefix, also implement `key(index)` and `length`. See [`clear()` with a prefix needs key enumeration](#clear-with-a-prefix-needs-key-enumeration).

### Use an asynchronous adapter

Implement `AsyncAdapter` and use `AsyncBrowserStorage`. Every method returns a promise.

```ts
import { type AsyncAdapter, AsyncBrowserStorage } from "@jmondi/browser-storage";

class IdbAdapter implements AsyncAdapter {
  async getItem(key: string): Promise<string | null> { /* ... */ }
  async setItem(key: string, value: string): Promise<void> { /* ... */ }
  async removeItem(key: string): Promise<void> { /* ... */ }
  async keys(): Promise<string[]> { /* ... */ } // enables clear() with a prefix
}

const storage = new AsyncBrowserStorage({ adapter: new IdbAdapter(), prefix: "app__" });
await storage.set("user", { email: "jason@example.com" });
await storage.get<User>("user");
```

With `migrate`, the migration runs once before the first call that touches the adapter. To run it up front, call `await storage.ready()`.

### Use a custom serializer

Implement `parse` and `stringify`. This example uses `superjson` to keep `Date` and `Map` values.

```ts
import superjson from "superjson";
import { LocalStorage, type Serializer } from "@jmondi/browser-storage";

class SuperJsonSerializer implements Serializer {
  parse<T = unknown>(value: string): T {
    return superjson.parse(value);
  }
  stringify<T = unknown>(value: T): string {
    return superjson.stringify(value);
  }
}

const storage = new LocalStorage({ serializer: new SuperJsonSerializer() });
```

## Reference

### Classes

| Class | Adapter | Use |
|---|---|---|
| `LocalStorage` | `globalThis.localStorage` | Data that survives a browser restart. |
| `SessionStorage` | `globalThis.sessionStorage` | Data that lives until the tab closes. |
| `BrowserStorage<SetConfig>` | Any `Adapter` | Custom synchronous storage. |
| `AsyncBrowserStorage<SetConfig>` | Any `AsyncAdapter` | Custom asynchronous storage. |

`LocalStorage` and `SessionStorage` fall back to `MemoryStorageAdapter` when the browser storage is unavailable or blocked, and log one message to the console.

### Constructor options

`LocalStorage` and `SessionStorage` accept `StorageConfig` without `adapter`. `BrowserStorage` accepts `StorageConfig`. `AsyncBrowserStorage` accepts `AsyncStorageConfig`, where `adapter` is required.

| Option | Type | Default | Description |
|---|---|---|---|
| `adapter` | `Adapter` / `AsyncAdapter` | `new MemoryStorageAdapter()` | Storage backend. |
| `prefix` | `string` | `""` | Prepended to every key. |
| `serializer` | `Serializer` | `JSON` | Converts values to and from strings. |
| `migrate` | `(string \| LegacyKeyMigration)[]` | `[]` | Legacy keys to copy onto prefixed keys. A string `k` means `{ from: k, to: k }`. |

### `LegacyKeyMigration`

| Field | Type | Default | Description |
|---|---|---|---|
| `from` | `string` | — | Legacy key, exactly as stored. |
| `to` | `string` | — | New key. Bare in `migrate` (the prefix is added); full in `migrateLegacyKeys()`. |
| `cleanup` | `boolean` | `true` | Remove `from` after a successful copy. |

### Storage methods

Async variants return a `Promise` of the same value. `key` arguments are bare; the prefix is added for you.

| Method | Returns | Description |
|---|---|---|
| `get<T>(key)` | `T \| null` | Parsed value, or `null` when absent. |
| `set(key, value, config?)` | `boolean` | `true` on success; `false` when the adapter or serializer throws. `undefined` is stored as `null`. |
| `remove(key)` | `void` | Removes the key. |
| `pop<T>(key)` | `T \| null` | `get` then `remove`. |
| `clear()` | `void` | With a prefix, removes only keys under it. Without, clears the whole store. |
| `define<T>(key, defaultConfig?)` | `DefineResponse<T>` | Bound `get`/`set`/`remove`/`pop` plus the full `key`. |
| `defineGroup<TypeMap>(map)` | `{ [name]: DefineResponse }` | `define` for every entry of `map`. |

`AsyncBrowserStorage` only:

| Method | Description |
|---|---|
| `ready()` | Resolves when the legacy-key migration has run. Called internally before every adapter access. |
| `getCache(key)`, `setCache(key, value)`, `removeCache(key)` | Read and write an in-memory buffer keyed by the full key. |
| `syncCache()` | Writes every buffered entry to the adapter. |

### Adapter interfaces

`Adapter<SetConfig>`:

| Member | Required | Description |
|---|---|---|
| `getItem(key): string \| null` | yes | |
| `setItem(key, value, config?): void` | yes | `config` is the per-write `SetConfig`. |
| `removeItem(key): void` | yes | |
| `clear(): void` | no | Used by `clear()` when there is no prefix. |
| `length: number`, `key(index): string \| null` | no | Enable `clear()` with a prefix. |

`AsyncAdapter<SetConfig>` is the same with `Promise` return types, and `keys(): Promise<string[]>` in place of `length`/`key`.

Native `Storage` objects and `MemoryStorageAdapter` satisfy `Adapter` in full.

### Serializers

| Export | `stringify` | `parse` |
|---|---|---|
| `JSON` (default) | `JSON.stringify` | `JSON.parse`; a parse error returns the raw string. |
| `RawStringSerializer` | Returns the string as is. Throws `TypeError` for non-strings, so `set()` returns `false`. | Returns the string as is. |

### Functions

| Function | Description |
|---|---|
| `migrateLegacyKeys(adapter, migrations)` | Runs the migration on a sync adapter. `to` is the full key. Idempotent. |
| `migrateLegacyKeysAsync(adapter, migrations)` | Same for an async adapter. |

### Exported types

`Adapter`, `AsyncAdapter`, `Serializer`, `StorageConfig`, `AsyncStorageConfig`, `LegacyKeyMigration`, `MigrateConfig`, `DefineResponse`, `AsyncDefineResponse`.

## Explanation

### Why values are always serialized

Every `set()` runs the value through the serializer, and every `get()` runs it back. This makes strings round-trip as strings: `set("pin", "1234")` then `get("pin")` returns `"1234"`, not `1234`. The cost is that the stored form of a string is `"\"1234\""`, which other code reading `localStorage` directly will see with quotes. The gain is that the type you put in is the type you get out.

### Parse failures return the raw string

Storage is shared with other code on the same origin, and with older versions of your own app. If `get()` finds a value the serializer cannot parse, it returns the string unchanged instead of throwing. This is why a JWT written by legacy code reads correctly with no migration work. The same rule has one side effect: a legacy value that happens to be valid JSON, such as `"true"`, parses successfully and changes type. `RawStringSerializer` exists for that case.

### Why migration is eager

The `migrate` option could have been a read-time fallback: look for the legacy key only when the prefixed key is empty. That design was tried and rejected for two reasons. First, `clear()` with a prefix enumerates the store by prefix and cannot see unprefixed legacy keys, so a token cleared at logout before its first read would come back on the next read. Second, it turns `get()` into an operation that writes, which can throw on quota. Running the migration once at construction keeps `get()` a pure read, and leaves the store in one consistent state that `clear()` can reason about. The extra cost is one `getItem` per migrated key at startup.

`AsyncBrowserStorage` cannot do work in its constructor, so it runs the migration before the first method that touches the adapter and memoizes the promise. `ready()` exposes that promise.

### `clear()` with a prefix needs key enumeration

`localStorage.clear()` wipes the whole origin, including keys from other code. With a prefix, this library only removes its own keys, which means it must list them first. Native `Storage` has `length` and `key(index)`. A custom sync adapter must provide the same, and a custom async adapter must provide `keys()`. Without them, `clear()` with a prefix throws rather than silently deleting too much or too little.

### Why `set()` returns a boolean

Browser storage can refuse a write at any time: quota exceeded, private mode, or a serializer that cannot encode the value. These are routine, so `set()` reports them as `false` instead of throwing. Read and remove errors are rare and usually indicate a broken adapter, so `get()`, `remove()`, and `pop()` let them propagate.

### `pop()` is not atomic

`pop()` is a `get` followed by a `remove`. A write from another tab between the two steps is lost. Browser storage has no transaction, so this cannot be fixed in the library.

### The async cache is a write buffer

`AsyncBrowserStorage` keeps an in-memory `MemoryStorageAdapter`. It is not a read-through cache: `get()` always asks the adapter. The cache methods let you collect writes and flush them with one `syncCache()` call.

## Upgrading to v2

**Serialization is symmetric.** Values are serialized on write and parsed on read, so strings round-trip as strings. v1 wrote strings verbatim, so a v1 string `"1234"` now parses as the number `1234`. Use `RawStringSerializer` for keys that must stay strings, or clear them.

**`clear()` is prefix-scoped.** With a `prefix`, `clear()` removes only keys under that prefix. A custom adapter must implement `key(index)` and `length` (sync) or `keys()` (async), otherwise `clear()` throws.

**Keys are typed.** `define<T>("key").get()` returns `T | null`. `defineGroup` accepts a type map. `DefineResponse` and `AsyncDefineResponse` take the value type as their first type parameter.

**v2.2 adds `migrate`** for adopting a prefix over existing keys, and `RawStringSerializer`. See [Adopt a prefix on an app that already has keys in storage](#adopt-a-prefix-on-an-app-that-already-has-keys-in-storage).
