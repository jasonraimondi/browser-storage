# @jmondi/browser-storage

An abstracted storage library for **browser** applications that interfaces with localStorage, sessionStorage, in-memory storage, or any custom serializer. It provides serialization capabilities with optional key prefixing for better storage management.

[![Deno Version](https://shield.deno.dev/x/browser_storage?style=flat-square)](https://deno.land/x/browser_storage)
[![Npmjs.org Version](https://img.shields.io/npm/v/@jmondi/browser-storage?style=flat-square)](https://www.npmjs.com/package/@jmondi/browser-storage)
[![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/jasonraimondi/browser-storage/test.yml?branch=main&label=Unit%20Tests&style=flat-square)](https://github.com/jasonraimondi/browser-storage)
[![Test Coverage](https://img.shields.io/codeclimate/coverage/jasonraimondi/browser-storage?style=flat-square)](https://codeclimate.com/github/jasonraimondi/browser-storage/test_coverage)
[![NPM Downloads](https://img.shields.io/npm/dt/@jmondi/browser-storage?label=npm%20downloads&style=flat-square)](https://www.npmjs.com/package/@jmondi/browser-storage)

## Install (npm)

```bash
pnpm add @jmondi/browser-storage
```

### Deno

```ts
import { 
  LocaleStorage, 
  SessionStorage, 
  BrowserStorage 
} from "https://deno.land/x/browser_storage"
```

## Usage

The `LocalStorage` and `SessionStorage` classes serve as helper abstractions over the built-in `window.localStorage` and `window.sessionStorage` web storage mechanisms respectively.

### Local Storage Adapter

Local storage is persistent after close.

```typescript
import { LocalStorage } from "@jmondi/browser-storage";

const storage = new LocalStorage();

storage.set("user2", { email: "hermoine@hogwarts.com", name: "Hermoine" });
console.log(storage.get("user2"));
// { email: "hermoine@hogwarts.com", name: "Hermoine" }
```

### Session Storage Adapter

Session storage is reset when the browser is closed.

```typescript
import { SessionStorage } from "@jmondi/browser-storage";

const storage = new SessionStorage();

storage.set("user2", { email: "hermoine@hogwarts.com", name: "Hermoine" });
console.log(storage.get("user2"));
// { email: "hermoine@hogwarts.com", name: "Hermoine" }
```

### Custom Storage Adapter

The BrowserStorage class gives you the option to use a custom storage adapter.

Underneath, both `LocalStorage` and `SessionStorage` extend the `BrowserStorage` class, which operates over an arbitrary storage adapter. This design enables you to extend `BrowserStorage` to interface with any custom storage provider of your choice.

For a custom storage provider to work correctly, it needs to implement the `Adapter` interface.

```ts
import { type Adapter, BrowserStorage } from "@jmondi/browser-storage";
import Cookies, { type CookieAttributes } from "js-cookie";

export class CookieAdapter implements Adapter {
  getItem(key: string): string | null {
    return Cookies.get(key) ?? null;
  }

  removeItem(key: string): void {
    Cookies.remove(key);
  }

  setItem(key: string, value: string, config: CookieAttributes): void {
    Cookies.set(key, value, config);
  }
}

const prefix = "app_"

export const storage = new BrowserStorage({ prefix, adapter: new CookieAdapter() });
storage.set("user2", { email: "hermoine@hogwarts.com", name: "Hermoine" }, { expires: 5 });
console.log(storage.get("user2"));
```

## Configuration

You can optionally provide a configuration object.

- `prefix`: This optional value will be prepended to every key when stored.
- `serializer`: This optional value can be any object that implements the `StorageSerializer` interface. By default, this is `JSON`.

```ts
import { BrowserStorage } from "./index.ts";

const localStorage = new LocalStorage({
  prefix: 'app_', // Optional. Defaults to "".
  serializer: JSON, // Optional. Defaults to JSON.
});
const sessionStorage = new SessionStorage({
  prefix: 'app_', // Optional. Defaults to "".
  serializer: JSON, // Optional. Defaults to JSON.
});
const browserStorage = new BrowserStorage({
  prefix: 'app_', // Optional. Defaults to "".
  serializer: JSON, // Optional. Defaults to JSON.
  adapter: Adapter, // Optional. Defaults to an InMemoryStorageProvider.
});
```

## Custom Serializers

The `StorageSerializer` is an interface which requires the implementation of two methods: `parse` and `stringify`. The default example of this is the built in [JSON](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON) object.

```ts
import superjson from "superjson";
import { StorageSerializer } from "@jmondi/browser-storage";

export class SuperJsonSerializer implements StorageSerializer {
  parse<T = unknown>(value: string): T {
    return superjson.parse(value);
  }
  stringify<T = unknown>(value: T): string {
    return superjson.stringify(value);
  }
}
```

## Defining a named group of keys

### The `define` method 

This method allows the creation of named keys in storage. Each key is associated with a type. Here's an example:

```typescript
const storage = new BrowserStorage(); // or LocalStorage, SessionStorage, etc.
const USER_COOKIE = storage.define<{ email: string }>("user_info");
USER_COOKIE.set({ email: "jason@example.com" });
USER_COOKIE.get(); // { email: "jason@example" }
USER_COOKIE.remove()
USER_COOKIE.get(); // null
```

In this example, `GROUP` has two keys: `token` and `user`.

### The `defineGroup` method

The `defineGroup` method provides a more concise way to define named keys. Here's an example:

```typescript
const storage = new BrowserStorage(); // or LocalStorage, SessionStorage, etc.

const GROUP = storage.defineGroup({
  token: "refresh_token",
  user: "user_info",
});

GROUP.token.set("newtoken");
GROUP.user.set({ email: "jason@example.com" });

GROUP.token.get(); // "newtoken"
GROUP.user.get(); // { email: "jason@example" }
```
