# @jmondi/browser-storage

An abstracted storage library for **browser** applications that interfaces with localStorage, sessionStorage, in-memory storage, or any custom serializer. It provides serialization capabilities with optional key prefixing for better storage management.

[![JSR](https://jsr.io/badges/@jmondi/browser-storage)](https://jsr.io/@jmondi/browser-storage)
[![JSR Score](https://jsr.io/badges/@jmondi/browser-storage/score)](https://jsr.io/@jmondi/browser-storage)
[![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/jasonraimondi/browser-storage/test.yml?branch=main&label=Unit%20Tests&style=flat-square)](https://github.com/jasonraimondi/browser-storage)
[![Test Coverage](https://img.shields.io/codeclimate/coverage/jasonraimondi/browser-storage?style=flat-square)](https://codeclimate.com/github/jasonraimondi/browser-storage/test_coverage)

## Installation

For Node.js:
```bash
pnpx jsr add @jmondi/browser-storage
```

For Deno:
```ts
deno add @jmondi/browser-storage
```

## Usage

`LocalStorage` and `SessionStorage` are wrappers for `window.localStorage` and `window.sessionStorage`.

```typescript
const storage = new LocalStorage({ prefix: "myapp" });
const LOCAL_STORAGE = storage.defineGroup({ token: "jti", current_user: "u" });
LOCAL_STORAGE.token.set("newtoken");
LOCAL_STORAGE.token.get(); // "newtoken"
LOCAL_STORAGE.token.remove();
LOCAL_STORAGE.current_user.set({ email: "jason@example.com" });
LOCAL_STORAGE.current_user.get(); // { email: "jason@example.com" }
LOCAL_STORAGE.current_user.remove();
```

### The LocalStorage class 

Persists after closing browser

```typescript
import { LocalStorage } from "@jmondi/browser-storage";

const storage = new LocalStorage();
storage.set("user2", { email: "hermoine@hogwarts.com" });
console.log(storage.get("user2")); 
// { email: "hermoine@hogwarts.com" }
```

### The SessionStorage class 

Resets on browser close

```typescript
import { SessionStorage } from "@jmondi/browser-storage";

const storage = new SessionStorage();
storage.set("user2", { email: "hermoine@hogwarts.com", name: "Hermoine" });
console.log(storage.get("user2")); // { email: "hermoine@hogwarts.com", name: "Hermoine" }
```

### Example Custom storage adapter

```ts
import { type Adapter, BrowserStorage } from "@jmondi/browser-storage";
import Cookies from "js-cookie";

export class CookieAdapter implements Adapter {
  getItem(key: string): string | null {
    return Cookies.get(key) ?? null;
  }
  removeItem(key: string): void {
    Cookies.remove(key);
  }
  setItem(key: string, value: string, config?: Cookies.CookieAttributes): void {
    Cookies.set(key, value, config);
  }
}

const storage = new BrowserStorage<Cookies.CookieAttributes>({
  prefix: "app_",
  adapter: new CookieAdapter(),
});
storage.set("user2", { email: "hermoine@hogwarts.com", name: "Hermoine" }, { expires: 5 });
console.log(storage.get("user2"));
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
  parse<T = unknown>(value: string): T { 
    return superjson.parse(value); 
  }
  stringify<T = unknown>(value: T): string { 
    return superjson.stringify(value); 
  }
}
```

## Advanced Usage / Organization Techniques

With defined storage groups you can organize related data into named groups, simplifying access and management.

### Defining Storage Groups

Use `defineGroup` for key groups.

```typescript
const storage = new LocalStorage({ prefix: "myapp" });
const LOCAL_STORAGE = storage.defineGroup({ token: "jti", current_user: "u" });
LOCAL_STORAGE.token.set("newtoken");
LOCAL_STORAGE.token.get(); // "newtoken"
LOCAL_STORAGE.token.remove();
LOCAL_STORAGE.current_user.set({ email: "jason@example.com" });
LOCAL_STORAGE.current_user.get(); // { email: "jason@example.com" }
LOCAL_STORAGE.current_user.remove();
```

### Defining Single Storage Key

Use `define` for individual keys. In this example, 

```typescript
type UserInfo = { email: string };
const storage = new LocalStorage();
const USER_INFO_STORAGE = storage.define<UserInfo>("user_info");
USER_INFO_STORAGE.set({ email: "jason@example.com" });
USER_INFO_STORAGE.get(); // gets the latest value
USER_INFO_STORAGE.remove(); // removes the value
```
