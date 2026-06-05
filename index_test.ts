import {
  AsyncBrowserStorage,
  BrowserStorage,
  LocalStorage,
  MemoryStorageAdapter,
  SessionStorage,
} from "./index.ts";
import type { Adapter, AsyncAdapter, Serializer } from "./index.ts";
import { assertEquals, assertThrows } from "jsr:@std/assert@^1";

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
    const stubSerializer: Serializer = { ...JSON };
    stubSerializer.parse = () => {
      throw new Error();
    };
    const storage = new BrowserStorage({
      adapter: stubStorage,
      serializer: stubSerializer,
    });

    storage.set("1", { message: "hello world" });
    assertEquals(storage.get("1"), null);
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
