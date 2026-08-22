import {
  AsyncBrowserStorage,
  BrowserStorage,
  LocalStorage,
  MemoryStorageAdapter,
  migrateLegacyKeys,
  migrateLegacyKeysAsync,
  RawStringSerializer,
  SessionStorage,
} from "./index.ts";
import type { Adapter, AsyncAdapter, Serializer } from "./index.ts";
import { assertEquals, assertThrows } from "@std/assert";

Deno.test("locale storage spec", async (t) => {
  await t.step("can set and remove values", () => {
    const storage = new LocalStorage();
    storage.clear();
    storage.set("one", "hello world");
    storage.set("two", { message: "hello world" });
    assertEquals(storage.get("one"), "hello world");
    assertEquals(storage.get("two"), { message: "hello world" });
    storage.remove("one");
    assertEquals(storage.get("one"), null);
  });

  await t.step("uses the native localStorage when it is writable", () => {
    assertEquals(new LocalStorage().adapter === globalThis.localStorage, true);
  });
});

Deno.test("session storage spec", async (t) => {
  await t.step("can set and remove values", () => {
    const storage = new SessionStorage();
    storage.clear();
    storage.set("one", "hello world");
    assertEquals(storage.get("one"), "hello world");
    storage.remove("one");
    assertEquals(storage.get("one"), null);
  });

  await t.step("uses the native sessionStorage when it is writable", () => {
    assertEquals(new SessionStorage().adapter === globalThis.sessionStorage, true);
  });
});

Deno.test("async browser storage", async (t) => {
  class TestAsyncAdapter implements AsyncAdapter {
    private storage = new Map<string, string | null>();

    getItem(key: string): Promise<string | null> {
      return Promise.resolve(this.storage.get(key) ?? null);
    }

    setItem(key: string, value: string): Promise<void> {
      this.storage.set(key, value);
      return Promise.resolve();
    }

    removeItem(key: string): Promise<void> {
      this.storage.delete(key);
      return Promise.resolve();
    }

    clear(): Promise<void> {
      this.storage.clear();
      return Promise.resolve();
    }
  }

  await t.step("can set and remove values", async () => {
    const storage = new AsyncBrowserStorage({ adapter: new TestAsyncAdapter() });
    await storage.set("one", "hello world");
    assertEquals(await storage.get("one"), "hello world");
    await storage.remove("one");
    assertEquals(await storage.get("one"), null);
  });

  await t.step("can pop values", async () => {
    const storage = new AsyncBrowserStorage({ adapter: new TestAsyncAdapter() });
    await storage.set("one", "hello world");
    assertEquals(await storage.pop("one"), "hello world");
    assertEquals(await storage.get("one"), null);
  });

  await t.step("can use cache", () => {
    const storage = new AsyncBrowserStorage({ adapter: new TestAsyncAdapter() });
    storage.setCache("one", "hello world");
    assertEquals(storage.getCache("one"), "hello world");
    storage.removeCache("one");
    assertEquals(storage.getCache("one"), null);
  });

  await t.step("can sync cache", async () => {
    const storage = new AsyncBrowserStorage({ adapter: new TestAsyncAdapter() });
    storage.setCache("one", "hello world");
    assertEquals(storage.getCache("one"), "hello world");
    assertEquals(await storage.get("one"), null);
    await storage.syncCache();
    assertEquals(await storage.get("one"), "hello world");
  });

  await t.step("cache respects prefix", async () => {
    const adapter = new TestAsyncAdapter();
    const storage = new AsyncBrowserStorage({ adapter, prefix: "p_" });
    storage.setCache("one", "hello world");
    assertEquals(storage.getCache("one"), "hello world");
    await storage.syncCache();
    assertEquals(await adapter.getItem("p_one"), "hello world");
    assertEquals(await storage.get("one"), "hello world");
  });

  await t.step("setCache stores empty string", () => {
    const storage = new AsyncBrowserStorage({ adapter: new TestAsyncAdapter() });
    storage.setCache("one", "");
    assertEquals(storage.getCache("one"), "");
  });

  await t.step("clear removes all values", async () => {
    const storage = new AsyncBrowserStorage({ adapter: new TestAsyncAdapter() });
    await storage.set("one", "hello world");
    await storage.set("two", "goodbye");
    await storage.clear();
    assertEquals(await storage.get("one"), null);
    assertEquals(await storage.get("two"), null);
  });

  await t.step("#define success", async () => {
    const storage = new AsyncBrowserStorage({ adapter: new TestAsyncAdapter(), prefix: "foo__" });
    const TOKEN = storage.define<string>("access_token");

    await TOKEN.set("ABC123");
    assertEquals(TOKEN.key, "foo__access_token");
    assertEquals(await TOKEN.get(), "ABC123");
    assertEquals(await storage.get("access_token"), "ABC123");
    assertEquals(await TOKEN.pop(), "ABC123");
    assertEquals(await TOKEN.get(), null);
  });

  await t.step("#defineGroup success", async () => {
    const storage = new AsyncBrowserStorage({ adapter: new TestAsyncAdapter() });
    const GROUP = storage.defineGroup({ token: "refresh_token", user: "user_info" });

    await GROUP.token.set("newtoken");
    await GROUP.user.set({ email: "jason@example.com" });

    assertEquals(await GROUP.token.get(), "newtoken");
    assertEquals(await GROUP.user.get(), { email: "jason@example.com" });
    assertEquals(await storage.get("refresh_token"), "newtoken");
    await GROUP.token.remove();
    assertEquals(await GROUP.token.get(), null);
  });
});

Deno.test("symmetric serialization", async (t) => {
  await t.step("strings round-trip without being reinterpreted", () => {
    const storage = new BrowserStorage();

    storage.set("pin", "1234");
    storage.set("flag", "true");
    storage.set("json", '{"a":1}');
    storage.set("nullish", "null");
    storage.set("empty", "");

    assertEquals(storage.get("pin"), "1234");
    assertEquals(storage.get("flag"), "true");
    assertEquals(storage.get("json"), '{"a":1}');
    assertEquals(storage.get("nullish"), "null");
    assertEquals(storage.get("empty"), "");
  });

  await t.step("non-string values round-trip as themselves", () => {
    const storage = new BrowserStorage();

    storage.set("num", 1234);
    storage.set("bool", true);
    storage.set("obj", { a: 1 });
    storage.set("zero", 0);
    storage.set("actualNull", null);

    assertEquals(storage.get("num"), 1234);
    assertEquals(storage.get("bool"), true);
    assertEquals(storage.get("obj"), { a: 1 });
    assertEquals(storage.get("zero"), 0);
    assertEquals(storage.get("actualNull"), null);
  });
});

Deno.test("prefix-scoped clear", async (t) => {
  await t.step("only removes keys under the prefix", () => {
    const adapter = new MemoryStorageAdapter();
    adapter.setItem("other__keep", "keep me");
    const storage = new BrowserStorage({ prefix: "app__", adapter });
    storage.set("token", "abc");
    storage.set("user", "jason");

    storage.clear();

    assertEquals(storage.get("token"), null);
    assertEquals(storage.get("user"), null);
    assertEquals(adapter.getItem("other__keep"), "keep me");
  });

  await t.step("empty prefix still clears everything", () => {
    const adapter = new MemoryStorageAdapter();
    adapter.setItem("anything", "x");
    const storage = new BrowserStorage({ adapter });
    storage.set("y", "y");

    storage.clear();

    assertEquals(adapter.getItem("anything"), null);
    assertEquals(storage.get("y"), null);
  });

  await t.step("throws when a prefix is set but the adapter can't enumerate", () => {
    const adapter: Adapter = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    };
    const storage = new BrowserStorage({ prefix: "p__", adapter });

    assertThrows(() => storage.clear());
  });

  await t.step("async only removes keys under the prefix", async () => {
    class EnumerableAsyncAdapter implements AsyncAdapter {
      storage = new Map<string, string>();
      getItem(key: string): Promise<string | null> {
        return Promise.resolve(this.storage.get(key) ?? null);
      }
      setItem(key: string, value: string): Promise<void> {
        this.storage.set(key, value);
        return Promise.resolve();
      }
      removeItem(key: string): Promise<void> {
        this.storage.delete(key);
        return Promise.resolve();
      }
      keys(): Promise<string[]> {
        return Promise.resolve([...this.storage.keys()]);
      }
    }
    const adapter = new EnumerableAsyncAdapter();
    adapter.storage.set("other__keep", "keep me");
    const storage = new AsyncBrowserStorage({ prefix: "app__", adapter });
    await storage.set("token", "abc");

    await storage.clear();

    assertEquals(await storage.get("token"), null);
    assertEquals(adapter.storage.get("other__keep"), "keep me");
  });
});

Deno.test("browser storage spec", async (t) => {
  await t.step("can set and remove values", () => {
    const storage = new BrowserStorage();
    storage.set("one", "hello world");
    assertEquals(storage.get("one"), "hello world");
    storage.remove("one");
    assertEquals(storage.get("one"), null);
  });

  await t.step("can pop values", () => {
    const storage = new BrowserStorage();
    storage.set("one", "hello world");
    assertEquals(storage.pop("one"), "hello world");
    assertEquals(storage.get("one"), null);
  });

  await t.step("can set, get, and remove fields and objects", () => {
    const storage = new BrowserStorage();

    storage.set("one", { hello: "world" });
    storage.set("2", "hello world");
    storage.set("3", null);
    storage.set("4");
    assertEquals(storage.get("one"), { hello: "world" });
    assertEquals(storage.get("2"), "hello world");
    assertEquals(storage.get("3"), null);
    assertEquals(storage.get("4"), null);

    storage.remove("one");
    storage.remove("2");
    storage.remove("3");
    storage.remove("4");
    assertEquals(storage.get("one"), null);
    assertEquals(storage.get("2"), null);
    assertEquals(storage.get("3"), null);
    assertEquals(storage.get("4"), null);
  });

  await t.step("namespaces storage", () => {
    const stubStorage = new MemoryStorageAdapter();
    const storage = new BrowserStorage({ prefix: "@testing:", adapter: stubStorage });

    stubStorage.setItem("1", "the wrong value");
    storage.set("1", "the correct value");

    assertEquals(stubStorage.getItem("1"), "the wrong value");
    assertEquals(storage.get("1"), "the correct value");
    assertEquals(stubStorage.getItem("@testing:1"), '"the correct value"');
  });

  await t.step("catches error", () => {
    const stubStorage = new MemoryStorageAdapter();
    const stubSerializer = {
      stringify: JSON.stringify,
      parse: () => {
        throw new Error();
      },
    } as Serializer;
    const storage = new BrowserStorage({
      adapter: stubStorage,
      serializer: stubSerializer,
    });

    assertEquals(storage.set("1", { message: "hello world" }), true);
    assertEquals(storage.get("1"), '{"message":"hello world"}');
  });

  await t.step("clear removes all values", () => {
    const storage = new BrowserStorage();
    storage.set("one", "hello world");
    storage.set("two", "goodbye");
    storage.clear();
    assertEquals(storage.get("one"), null);
    assertEquals(storage.get("two"), null);
  });

  await t.step("set returns false when the adapter throws", () => {
    class ThrowingAdapter extends MemoryStorageAdapter {
      override setItem(): void {
        throw new Error("quota exceeded");
      }
    }
    const storage = new BrowserStorage({ adapter: new ThrowingAdapter() });
    assertEquals(storage.set("1", "value"), false);
  });
});

Deno.test("adapters with custom setItem config", async (t) => {
  class TestingAdapter extends MemoryStorageAdapter {
    public config: unknown = null;

    override setItem(key: string, value: string, config?: unknown) {
      super.setItem(key, value);
      this.config = config;
    }
  }

  await t.step("can send an optional config", () => {
    const adapter = new TestingAdapter();
    const testing = new BrowserStorage({ adapter });

    testing.set("1", "hello world", { config: "test" });

    assertEquals(adapter.config, { config: "test" });
  });

  await t.step("define threads its default config to set", () => {
    const adapter = new TestingAdapter();
    const testing = new BrowserStorage({ adapter });
    const TOKEN = testing.define("token", { config: "default" });

    TOKEN.set("abc");
    assertEquals(adapter.config, { config: "default" });

    TOKEN.set("abc", { config: "override" });
    assertEquals(adapter.config, { config: "override" });
  });
});

Deno.test("typed define and defineGroup (compile-time checks)", () => {
  // The value of this test is in `deno check`; the bodies that must NOT type-check
  // are wrapped in never-invoked arrows so the @ts-expect-error fires without mutating.
  const storage = new BrowserStorage();

  const TOKEN = storage.define<string>("access_token");
  const _tokenValue: string | null = TOKEN.get();
  // @ts-expect-error a string slot rejects numbers
  const _setToken = () => TOKEN.set(123);

  const GROUP = storage.defineGroup<{ token: string; user: { email: string } }>({
    token: "refresh_token",
    user: "user_info",
  });
  const _userValue: { email: string } | null = GROUP.user.get();
  // @ts-expect-error the user slot holds an object, not a string
  const _setUser = () => GROUP.user.set("nope");

  const inferred = storage.defineGroup({ token: "refresh_token", user: "user_info" });
  const _token: unknown = inferred.token.get();
  const _user: unknown = inferred.user.get();
  // @ts-expect-error aliases are inferred, so unknown members are rejected
  const _missing = () => inferred.missing;
});

Deno.test("defining named groups", async (t) => {
  await t.step("#define success", () => {
    const storage = new BrowserStorage({ prefix: "foo__" });

    const GROUP = {
      token: storage.define<string>("access_token"),
      user: storage.define<{ email: string }>("user_info"),
    };

    GROUP.token.set("ABC123");
    GROUP.user.set({ email: "jason@example.com" });
    storage.set("user_test", { email: "testing@example.com" });

    assertEquals(GROUP.token.key, "foo__access_token");
    assertEquals(GROUP.token.get(), "ABC123");
    assertEquals(storage.get("user_test"), { email: "testing@example.com" });
    assertEquals(storage.get("access_token"), "ABC123");
    assertEquals(storage.get("user_info"), { email: "jason@example.com" });
    GROUP.token.remove();
    GROUP.user.remove();
    assertEquals(GROUP.token.get(), null);
    assertEquals(GROUP.user.get(), null);
  });

  await t.step("#defineGroup success", () => {
    const storage = new BrowserStorage();
    const GROUP = storage.defineGroup({
      token: "refresh_token",
      user: "user_info",
    });

    GROUP.token.set("newtoken");
    GROUP.user.set({ email: "jason@example.com" });
    storage.set("user_test", { email: "testing@example.com" });

    assertEquals(GROUP.token.get(), "newtoken");
    assertEquals(GROUP.user.get(), { email: "jason@example.com" });
    assertEquals(storage.get("refresh_token"), "newtoken");
    assertEquals(storage.get("user_info"), { email: "jason@example.com" });
    assertEquals(storage.get("user_test"), { email: "testing@example.com" });
    GROUP.token.remove();
    GROUP.user.remove();
    assertEquals(GROUP.token.get(), null);
    assertEquals(GROUP.user.get(), null);
  });
});

Deno.test("coverage: prefix", async (t) => {
  await t.step("defineGroup with prefix produces prefixed keys and stores under them", () => {
    const adapter = new MemoryStorageAdapter();
    const storage = new BrowserStorage({ prefix: "app__", adapter });
    const GROUP = storage.defineGroup({ token: "access_token", user: "user_info" });

    GROUP.token.set("ABC123");

    assertEquals(GROUP.token.key, "app__access_token");
    assertEquals(GROUP.user.key, "app__user_info");
    assertEquals(adapter.getItem("app__access_token"), '"ABC123"');
    assertEquals(adapter.getItem("access_token"), null);
    assertEquals(GROUP.token.get(), "ABC123");
  });

  await t.step("async set returns false when the adapter throws", async () => {
    class ThrowingAsyncAdapter implements AsyncAdapter {
      getItem(): Promise<string | null> {
        return Promise.resolve(null);
      }
      setItem(): Promise<void> {
        return Promise.reject(new Error("quota exceeded"));
      }
      removeItem(): Promise<void> {
        return Promise.resolve();
      }
    }
    const storage = new AsyncBrowserStorage({ adapter: new ThrowingAsyncAdapter() });

    assertEquals(await storage.set("one", "hello world"), false);
    assertEquals(await storage.get("one"), null);
  });

  await t.step("empty string value round-trips", () => {
    const storage = new BrowserStorage({ prefix: "app__" });

    storage.set("empty", "");

    assertEquals(storage.get("empty"), "");
  });

  await t.step("async empty string value round-trips", async () => {
    class TestAsyncAdapter implements AsyncAdapter {
      private storage = new Map<string, string>();
      getItem(key: string): Promise<string | null> {
        return Promise.resolve(this.storage.get(key) ?? null);
      }
      setItem(key: string, value: string): Promise<void> {
        this.storage.set(key, value);
        return Promise.resolve();
      }
      removeItem(key: string): Promise<void> {
        this.storage.delete(key);
        return Promise.resolve();
      }
    }
    const storage = new AsyncBrowserStorage({
      adapter: new TestAsyncAdapter(),
      prefix: "app__",
    });

    await storage.set("empty", "");

    assertEquals(await storage.get("empty"), "");
  });
});

Deno.test("legacy key migration", async (t) => {
  class CountingAdapter extends MemoryStorageAdapter {
    reads: string[] = [];
    override getItem(key: string): string | null {
      this.reads.push(key);
      return super.getItem(key);
    }
  }

  await t.step("migrates on first get() and returns the legacy value", () => {
    const adapter = new CountingAdapter();
    adapter.setItem("token", "eyJhbGciOi.abc.def");
    const storage = new BrowserStorage({ adapter, prefix: "app__", migrate: ["token"] });
    assertEquals(storage.get("token"), "eyJhbGciOi.abc.def");
    assertEquals(adapter.getItem("app__token"), "eyJhbGciOi.abc.def");
    assertEquals(adapter.getItem("token"), null);
  });

  await t.step("second read does not touch the legacy key", () => {
    const adapter = new CountingAdapter();
    adapter.setItem("token", "abc");
    const storage = new BrowserStorage({ adapter, prefix: "app__", migrate: ["token"] });
    storage.get("token");
    adapter.reads = [];
    assertEquals(storage.get("token"), "abc");
    assertEquals(adapter.reads, ["app__token"]);
  });

  await t.step("cleanup: false leaves the legacy key intact", () => {
    const adapter = new MemoryStorageAdapter();
    adapter.setItem("token", "abc");
    const storage = new BrowserStorage({
      adapter,
      prefix: "app__",
      migrate: [{ from: "token", to: "token", cleanup: false }],
    });
    assertEquals(storage.get("token"), "abc");
    assertEquals(adapter.getItem("token"), "abc");
    assertEquals(adapter.getItem("app__token"), "abc");
  });

  await t.step("can rename a key during migration", () => {
    const adapter = new MemoryStorageAdapter();
    adapter.setItem("orgId", "42");
    const storage = new BrowserStorage({
      adapter,
      prefix: "app__",
      migrate: [{ from: "orgId", to: "organizationId" }],
    });
    assertEquals(storage.get("organizationId"), 42);
    assertEquals(adapter.getItem("app__organizationId"), "42");
    assertEquals(adapter.getItem("orgId"), null);
  });

  await t.step("a legacy key that is never read stays unmigrated", () => {
    const adapter = new CountingAdapter();
    adapter.setItem("token", "abc");
    adapter.setItem("other", "xyz");
    const storage = new BrowserStorage({ adapter, prefix: "app__", migrate: ["token", "other"] });
    storage.get("other");
    assertEquals(adapter.reads.includes("token"), false);
    assertEquals(adapter.getItem("token"), "abc");
    assertEquals(adapter.getItem("app__token"), null);
  });

  await t.step("an existing new value wins over the legacy value", () => {
    const adapter = new MemoryStorageAdapter();
    adapter.setItem("token", "old");
    adapter.setItem("app__token", JSON.stringify("new"));
    const storage = new BrowserStorage({ adapter, prefix: "app__", migrate: ["token"] });
    assertEquals(storage.get("token"), "new");
    assertEquals(adapter.getItem("token"), "old");
  });

  await t.step("prefix-scoped clear() still works through the decorator", () => {
    const adapter = new MemoryStorageAdapter();
    adapter.setItem("token", "abc");
    adapter.setItem("keep", "me");
    const storage = new BrowserStorage({ adapter, prefix: "app__", migrate: ["token"] });
    storage.get("token");
    storage.set("extra", 1);
    storage.clear();
    assertEquals(adapter.length, 1);
    assertEquals(adapter.getItem("keep"), "me");
  });

  await t.step("migrateLegacyKeys works standalone with resolved keys", () => {
    const adapter = new MemoryStorageAdapter();
    adapter.setItem("token", "abc");
    const wrapped = migrateLegacyKeys(adapter, [{ from: "token", to: "app__token" }]);
    assertEquals(wrapped.getItem("app__token"), "abc");
    assertEquals(wrapped.getItem("missing"), null);
  });

  await t.step("LocalStorage accepts migrate", () => {
    const storage = new LocalStorage({ prefix: "app__", migrate: ["token"] });
    storage.clear();
    storage.adapter.setItem("token", "abc");
    assertEquals(storage.get("token"), "abc");
    assertEquals(storage.adapter.getItem("token"), null);
    storage.clear();
  });

  await t.step("async: migrates on first get(), cleanup respected, idempotent", async () => {
    const reads: string[] = [];
    const map = new Map<string, string>([["token", "abc"], ["keep", "k"]]);
    const adapter: AsyncAdapter = {
      getItem: (key) => {
        reads.push(key);
        return Promise.resolve(map.get(key) ?? null);
      },
      setItem: (key, value) => {
        map.set(key, value);
        return Promise.resolve();
      },
      removeItem: (key) => {
        map.delete(key);
        return Promise.resolve();
      },
    };
    const storage = new AsyncBrowserStorage({
      adapter,
      prefix: "app__",
      migrate: ["token", { from: "keep", to: "keep", cleanup: false }],
    });
    assertEquals(await storage.get("token"), "abc");
    assertEquals(map.get("app__token"), "abc");
    assertEquals(map.has("token"), false);
    reads.length = 0;
    assertEquals(await storage.get("token"), "abc");
    assertEquals(reads, ["app__token"]);
    assertEquals(await storage.get("keep"), "k");
    assertEquals(map.get("keep"), "k");
    const wrapped = migrateLegacyKeysAsync(adapter, []);
    assertEquals(await wrapped.getItem("nope"), null);
  });
});

Deno.test("RawStringSerializer", async (t) => {
  await t.step("keeps numeric-looking and boolean-looking strings as strings", () => {
    const adapter = new MemoryStorageAdapter();
    adapter.setItem("id", "12345");
    adapter.setItem("flag", "true");
    const raw = new BrowserStorage({ adapter, serializer: RawStringSerializer });
    const json = new BrowserStorage({ adapter });
    assertEquals(raw.get("id"), "12345");
    assertEquals(raw.get("flag"), "true");
    assertEquals(json.get("id"), 12345);
    assertEquals(json.get("flag"), true);
  });

  await t.step("writes plain strings without quotes", () => {
    const adapter = new MemoryStorageAdapter();
    const raw = new BrowserStorage({ adapter, serializer: RawStringSerializer });
    raw.set("id", "12345");
    assertEquals(adapter.getItem("id"), "12345");
  });
});
