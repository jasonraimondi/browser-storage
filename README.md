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
import { DateDuration } from "https://deno.land/x/browser_storage";
```

## Usage

The `LocalStorage` and `SessionStorage` classes serve as helper abstractions over the built-in `window.localStorage` and `window.sessionStorage` web storage mechanisms respectively.

### Local Storage

Local storage is persistent after close.

```typescript
import { LocalStorage } from "@jmondi/browser-storage";

const storage = new LocalStorage();

storage.set("user1", null);
storage.set("user2", { email: "hermoine@hogwarts.com", name: "Hermoine" });

console.log(storage.get("user1"));
// null
console.log(storage.get("user2"));
// { email: "hermoine@hogwarts.com", name: "Hermoine" }
```

### Session Storage

Session storage is reset when the browser is closed.

```typescript
import { SessionStorage } from "@jmondi/browser-storage";

const storage = new SessionStorage();

storage.set("user1", null);
storage.set("user2", { email: "hermoine@hogwarts.com", name: "Hermoine" });

console.log(storage.get("user1"));
// null
console.log(storage.get("user2"));
// { email: "hermoine@hogwarts.com", name: "Hermoine" }
```


## Configuration

You can optionally provide a configuration object.

- `prefix`: This optional value will be prepended to every key when stored.
- `serializer`: This optional value can be any object that implements the `StorageSerializer` interface. By default, this is `JSON`.

```ts
const storage = new LocalStorage({
  prefix: 'app_', // Optional. Defaults to "".
  serializer: JSON // Optional. Defaults to JSON.
});
```

## Custom Storage Adapter

Underneath, both `LocalStorage` and `SessionStorage` extend the `AbstractStorage` class, which operates over an arbitrary storage adapter. This design enables you to extend `AbstractStorage` to interface with any custom storage provider of your choice.

For a custom storage provider to work correctly, it needs to adhere to the browser's [Storage interface](https://developer.mozilla.org/en-US/docs/Web/API/Storage) – that is, it must implement methods such as `getItem`, `setItem`, `removeItem`, and `clear`, along with the `length` property. As an example, the provided `MemoryStorageProvider` class is a valid storage provider that stores data in an in-memory JavaScript map.

```ts
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
