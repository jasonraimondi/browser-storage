import {
  AsyncAdapter,
  AsyncBrowserStorage,
  BrowserStorage,
  LocalStorage,
  MemoryStorageAdapter,
  Serializer,
  SessionStorage,
} from "./index.ts";
import { assertEquals } from "https://deno.land/std@0.191.0/testing/asserts.ts";

Deno.test("locale storage spec", async (t) => {
  await t.step("can set and remove values", () => {
    const storage = new LocalStorage();
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
    storage.set("one", "hello world");
    assertEquals(storage.get("one"), "hello world");
    storage.remove("one");
    assertEquals(storage.get("one"), null);
  });
});

Deno.test("async browser storage", async (t) => {
  class TestAsyncAdapter implements AsyncAdapter {
    private storage = new Map<string, string | null>();

    async getItem(key: string, config?: {}) {
      return this.storage.get(key) ?? null;
    }

    async setItem(key: string, value: string) {
      this.storage.set(key, value);
    }

    async removeItem(key: string, config?: {}) {
      this.storage.delete(key);
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

  await t.step("can use cache", async () => {
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
    assertEquals(stubStorage.getItem("@testing:1"), "the correct value");
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
});

Deno.test("adapters with custom setItem config", async (t) => {
  class TestingAdapter extends MemoryStorageAdapter {
    public config: unknown = null;

    setItem(key: string, value: string, config?: {}) {
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
