# @jmondi/browser-storage

An abstracted storage library for **browser** applications that interfaces with localStorage, sessionStorage, in-memory storage, or any custom serializer. It provides serialization capabilities with optional key prefixing for better storage management.

[![Deno Version](https://shield.deno.dev/x/browser_storage?style=flat-square)](https://deno.land/x/browser_storage)
[![Npmjs.org Version](https://img.shields.io/npm/v/@jmondi/browser-storage?style=flat-square)](https://www.npmjs.com/package/@jmondi/browser-storage)
[![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/jasonraimondi/browser-storage/test.yml?branch=main&label=Unit%20Tests&style=flat-square)](https://github.com/jasonraimondi/browser-storage)
[![Test Coverage](https://img.shields.io/codeclimate/coverage/jasonraimondi/browser-storage?style=flat-square)](https://codeclimate.com/github/jasonraimondi/browser-storage/test_coverage)
[![NPM Downloads](https://img.shields.io/npm/dt/@jmondi/browser-storage?label=npm%20downloads&style=flat-square)](https://www.npmjs.com/package/@jmondi/browser-storage)
![npm bundle size](https://img.shields.io/bundlephobia/min/%40jmondi%2Fbrowser-storage)
![npm bundle size](https://img.shields.io/bundlephobia/minzip/%40jmondi%2Fbrowser-storage)


## Installation

```bash
pnpm add @jmondi/browser-storage
```

For Deno:
```ts
import { LocaleStorage, SessionStorage, BrowserStorage } from "https://deno.land/x/browser_storage"
```

## Usage

`LocalStorage` and `SessionStorage` are wrappers for `window.localStorage` and `window.sessionStorage`.

### LocalStorage 

Persists after closing browser:

```typescript
import { LocalStorage } from "@jmondi/browser-storage";

const storage = new LocalStorage();
storage.set("user2", { email: "hermoine@hogwarts.com", name: "Hermoine" });
console.log(storage.get("user2")); // { email: "hermoine@hogwarts.com", name: "Hermoine" }
```

### SessionStorage 

Resets on browser close:

```typescript
import { SessionStorage } from "@jmondi/browser-storage";

const storage = new SessionStorage();
storage.set("user2", { email: "hermoine@hogwarts.com", name: "Hermoine" });
console.log(storage.get("user2")); // { email: "hermoine@hogwarts.com", name: "Hermoine" }
```

### Custom storage adapter:

```ts
import { type Adapter, BrowserStorage } from "@jmondi/browser-storage";
import Cookies, { type CookieAttributes } from "js-cookie";

export class CookieAdapter implements Adapter {
  getItem(key: string): string | null { return Cookies.get(key) ?? null; }
  removeItem(key: string): void { Cookies.remove(key); }
  setItem(key: string, value: string, config: CookieAttributes): void { Cookies.set(key, value, config); }
}

const storage = new BrowserStorage({ prefix: "app_", adapter: new CookieAdapter() });
storage.set("user2", { email: "hermoine@hogwarts.com", name: "Hermoine" }, { expires: 5 });
console.log(storage.get("user2"));
```

## Defining Storage Groups

- Use `define` for individual keys:

```typescript
const storage = new BrowserStorage();
const USER_COOKIE = storage.define<{ email: string }>("user_info");
USER_COOKIE.set({ email: "jason@example.com" });
```

- Use `defineGroup` for key groups:

```typescript
const storage = new BrowserStorage();

const GROUP = storage.defineGroup({ token: "refresh_token", user: "user_info" });
GROUP.token.set("newtoken");
GROUP.user.set({ email: "jason@example.com" });
```

## Configuration

Optional settings: `prefix` (key prefix), `serializer` (defaults to `JSON`).

```ts
import { BrowserStorage } from "./index.ts";

const storage = new LocalStorage({ prefix: 'app_', serializer: JSON });
```

## Custom Serializers

To create a custom serializer, implement `parse` and `stringify`.

```ts
import superjson from "superjson";
import { StorageSerializer } from "@jmondi/browser-storage";

export class SuperJsonSerializer implements StorageSerializer {
  parse<T = unknown>(value: string): T { return superjson.parse(value); }
  stringify<T = unknown>(value: T): string { return superjson.stringify(value); }
}
```
