# @jmondi/browser-storage

Typed, prefixed, and serialized access to `localStorage`, `sessionStorage`, memory, or a custom adapter. No dependencies.

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

In this tutorial you store a typed object in `localStorage`, read it, and remove it. You need a TypeScript project that runs in a browser or in Deno.

1. Install the package.

   ```bash
   npx jsr add @jmondi/browser-storage   # Node, Bun, or a bundler
   deno add jsr:@jmondi/browser-storage  # Deno
   ```

2. Create a storage with a prefix. The prefix separates your keys from the keys of other code on the same origin.

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

   Open DevTools → Application → Local Storage. The key `app__user` has the value `{"email":"jason@example.com"}`.

4. Read the value. The library parses it and applies the type.

   ```ts
   const user = USER.get(); // User | null
   user?.email; // "jason@example.com"
   ```

5. Remove it.

   ```ts
   USER.remove();
   USER.get(); // null
   ```

You now have a typed key that stays after a page reload. To group many keys, continue with [Define a group of keys](#define-a-group-of-keys).

## How-to guides

Each guide solves one task. Read [Get started](#get-started) first.

### Define a group of keys

Pass a map from names to storage keys. Add a type map to set the type of each key.

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

Use `SessionStorage`. It has the same API as `LocalStorage`. The browser clears it when the tab closes.

```ts
import { SessionStorage } from "@jmondi/browser-storage";

const session = new SessionStorage({ prefix: "app__" });
```

### Adopt a prefix on an app that already has keys in storage

When you add a `prefix`, keys written without it become invisible: `get("token")` now reads `app__token`. Pass `migrate` with the legacy key names. The constructor copies each legacy key to its prefixed key and then removes the legacy key.

```ts
const storage = new LocalStorage({
  prefix: "app__",
  migrate: ["token", "orgId"],
});

storage.get("token"); // value that was stored under "token"
```

Use the object form to rename a key or to keep the legacy key.

```ts
migrate: [
  { from: "orgId", to: "organizationId" },      // "orgId" → "app__organizationId"
  { from: "theme", to: "theme", cleanup: false }, // copy, but keep "theme"
]
```

A prefixed key that already has a value keeps that value. If the write fails, for example when the quota is full, the legacy key stays in storage and the migration skips that key.

### Keep legacy string values as strings

The default serializer is `JSON`. A legacy raw value such as `"12345"` or `"true"` is valid JSON, so `get()` returns the number `12345` or the boolean `true`. To keep these values as strings, put the keys on a storage that uses `RawStringSerializer`.

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

A value that is not valid JSON, such as a JWT, reads as a string with the default serializer also. See [Parse failures return the raw string](#parse-failures-return-the-raw-string).

### Migrate keys on an adapter directly

Use the standalone functions when you manage the adapter yourself. In these functions, `to` is the full key with the prefix.

```ts
import { migrateLegacyKeys, migrateLegacyKeysAsync } from "@jmondi/browser-storage";

migrateLegacyKeys(localStorage, [{ from: "token", to: "app__token" }]);
await migrateLegacyKeysAsync(myAsyncAdapter, [{ from: "token", to: "app__token" }]);
```

Both functions are idempotent. A second call makes no change.

### Write a custom adapter

Implement `getItem`, `setItem`, and `removeItem`. The third `setItem` argument is an optional config for one write. You define its type and pass it to `BrowserStorage`.

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

To support `clear()` with a prefix, implement `key(index)` and `length` also. See [`clear()` with a prefix needs key enumeration](#clear-with-a-prefix-needs-key-enumeration).

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

With `migrate`, the migration runs one time before the first call that uses the adapter. To run it early, call `await storage.ready()`.

### Use a custom serializer

Implement `parse` and `stringify`. This example uses `superjson` to store `Date` and `Map` values.

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
| `LocalStorage` | `globalThis.localStorage` | Data that stays after a browser restart. |
| `SessionStorage` | `globalThis.sessionStorage` | Data that stays until the tab closes. |
| `BrowserStorage<SetConfig>` | Any `Adapter` | Custom synchronous storage. |
| `AsyncBrowserStorage<SetConfig>` | Any `AsyncAdapter` | Custom asynchronous storage. |

If the browser storage is not available or is blocked, `LocalStorage` and `SessionStorage` use `MemoryStorageAdapter` and write one message to the console.

### Constructor options

`LocalStorage` and `SessionStorage` accept `StorageConfig` without `adapter`. `BrowserStorage` accepts `StorageConfig`. `AsyncBrowserStorage` accepts `AsyncStorageConfig`. There, `adapter` is required.

| Option | Type | Default | Description |
|---|---|---|---|
| `adapter` | `Adapter` / `AsyncAdapter` | `new MemoryStorageAdapter()` | Storage backend. |
| `prefix` | `string` | `""` | Text added to the start of every key. |
| `serializer` | `Serializer` | `JSON` | Converts values to and from strings. |
| `migrate` | `(string \| LegacyKeyMigration)[]` | `[]` | Legacy keys to copy onto prefixed keys. A string `k` means `{ from: k, to: k }`. |

### `LegacyKeyMigration`

| Field | Type | Default | Description |
|---|---|---|---|
| `from` | `string` | — | Legacy key, as stored. |
| `to` | `string` | — | New key. In `migrate` it has no prefix; the library adds it. In `migrateLegacyKeys()` it is the full key. |
| `cleanup` | `boolean` | `true` | Remove `from` after a successful copy. |

### Storage methods

Async variants return a `Promise` of the same value. `key` arguments have no prefix; the library adds it.

| Method | Returns | Description |
|---|---|---|
| `get<T>(key)` | `T \| null` | Parsed value, or `null` if the key is not present. |
| `set(key, value, config?)` | `boolean` | `true` on success; `false` if the adapter or the serializer throws. Stores `undefined` as `null`. |
| `remove(key)` | `void` | Removes the key. |
| `pop<T>(key)` | `T \| null` | `get` then `remove`. |
| `clear()` | `void` | With a prefix, removes only the keys that start with it. Without a prefix, clears the full store. |
| `define<T>(key, defaultConfig?)` | `DefineResponse<T>` | Bound `get`/`set`/`remove`/`pop` plus the full `key`. |
| `defineGroup<TypeMap>(map)` | `{ [name]: DefineResponse }` | `define` for every entry of `map`. |

`AsyncBrowserStorage` only:

| Method | Description |
|---|---|
| `ready()` | Resolves when the legacy-key migration is complete. Each adapter access calls it first. |
| `getCache(key)`, `setCache(key, value)`, `removeCache(key)` | Read and write an in-memory buffer. Use the full key. |
| `syncCache()` | Writes every buffered entry to the adapter. |

### Adapter interfaces

`Adapter<SetConfig>`:

| Member | Required | Description |
|---|---|---|
| `getItem(key): string \| null` | yes | |
| `setItem(key, value, config?): void` | yes | `config` is the `SetConfig` for one write. |
| `removeItem(key): void` | yes | |
| `clear(): void` | no | `clear()` uses it when there is no prefix. |
| `length: number`, `key(index): string \| null` | no | Make `clear()` with a prefix possible. |

`AsyncAdapter<SetConfig>` is the same, but each member returns a `Promise`, and `keys(): Promise<string[]>` replaces `length` and `key`.

Native `Storage` objects and `MemoryStorageAdapter` implement all members of `Adapter`.

### Serializers

| Export | `stringify` | `parse` |
|---|---|---|
| `JSON` (default) | `JSON.stringify` | `JSON.parse`. On a parse error, returns the raw string. |
| `RawStringSerializer` | Returns the string unchanged. Throws `TypeError` for a non-string, so `set()` returns `false`. | Returns the string unchanged. |

### Functions

| Function | Description |
|---|---|
| `migrateLegacyKeys(adapter, migrations)` | Runs the migration on a sync adapter. `to` is the full key. Idempotent. |
| `migrateLegacyKeysAsync(adapter, migrations)` | The same, for an async adapter. |

### Exported types

`Adapter`, `AsyncAdapter`, `Serializer`, `StorageConfig`, `AsyncStorageConfig`, `LegacyKeyMigration`, `MigrateConfig`, `DefineResponse`, `AsyncDefineResponse`.

## Explanation

### Why values are always serialized

Each `set()` passes the value through the serializer. Each `get()` passes it back. So a string stays a string: `set("pin", "1234")` then `get("pin")` returns `"1234"`, not `1234`. The cost: the stored form of a string is `"\"1234\""`, and other code that reads `localStorage` directly sees the quotes. The benefit: the type you write is the type you read.

### Parse failures return the raw string

Other code on the same origin, and older versions of your app, share the storage. If `get()` finds a value that the serializer cannot parse, it returns the string unchanged. It does not throw. This is why a JWT written by legacy code reads correctly with no migration. The rule has one side effect: a legacy value that is valid JSON, such as `"true"`, parses and changes type. `RawStringSerializer` is for that case.

### Why migration is eager

The `migrate` option could work at read time: look for the legacy key only when the prefixed key is empty. We tried that design and rejected it for two reasons. First, `clear()` with a prefix lists the store by prefix and cannot see legacy keys without the prefix. A token cleared at logout before its first read would come back on the next read. Second, a read-time design makes `get()` write, and a write can throw when the quota is full. A migration that runs one time in the constructor keeps `get()` a pure read. It also leaves the store in one known state that `clear()` can handle. The extra cost is one `getItem` call per migrated key at startup.

`AsyncBrowserStorage` cannot await in its constructor. It runs the migration before the first method that uses the adapter, and it keeps the promise. `ready()` returns that promise.

### `clear()` with a prefix needs key enumeration

`localStorage.clear()` removes all keys on the origin, including keys from other code. With a prefix, this library removes only its own keys. To do that, it must list the keys first. Native `Storage` has `length` and `key(index)`. A custom sync adapter must have the same. A custom async adapter must have `keys()`. Without them, `clear()` with a prefix throws. It does not delete too much or too little without a warning.

### Why `set()` returns a boolean

Browser storage can reject a write at any time: the quota is full, the browser is in private mode, or the serializer cannot encode the value. These are normal conditions, so `set()` returns `false` and does not throw. Read and remove errors are rare and usually show a broken adapter, so `get()`, `remove()`, and `pop()` let them propagate.

### `pop()` is not atomic

`pop()` is a `get` and then a `remove`. A write from another tab between the two steps is lost. Browser storage has no transactions, so the library cannot prevent this.

### The async cache is a write buffer

`AsyncBrowserStorage` keeps an in-memory `MemoryStorageAdapter`. It is not a read-through cache: `get()` always reads from the adapter. Use the cache methods to collect writes, then write them all with one `syncCache()` call.

## Upgrading to v2

**Serialization is symmetric.** The library serializes values on write and parses them on read, so a string stays a string. v1 wrote strings unchanged, so a v1 string `"1234"` now parses as the number `1234`. Use `RawStringSerializer` for keys that must stay strings, or clear them.

**`clear()` applies to the prefix.** With a `prefix`, `clear()` removes only the keys that start with it. A custom adapter must implement `key(index)` and `length` (sync) or `keys()` (async). If not, `clear()` throws.

**Keys are typed.** `define<T>("key").get()` returns `T | null`. `defineGroup` accepts a type map. `DefineResponse` and `AsyncDefineResponse` take the value type as their first type parameter.

**v2.2 adds `migrate`** for adopting a prefix over existing keys, and `RawStringSerializer`. See [Adopt a prefix on an app that already has keys in storage](#adopt-a-prefix-on-an-app-that-already-has-keys-in-storage).
