import { BrowserStorage, LocalStorage, MemoryStorageProvider, SessionStorage } from "./index.ts";
import { assertEquals } from "https://deno.land/std@0.175.0/testing/asserts.ts";

Deno.test("locale storage spec", async (t) => {
  await t.step("can set and remove values", () => {
    const storage = new LocalStorage();
    storage.set("one", "hello world");
    assertEquals(storage.get("one"), "hello world");
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

Deno.test("abstract storage spec", async (t) => {
  let browserStorage;

  await t.step("can set and remove values", () => {
    browserStorage = new BrowserStorage();
    browserStorage.set("one", "hello world");
    assertEquals(browserStorage.get("one"), "hello world");
    browserStorage.remove("one");
    assertEquals(browserStorage.get("one"), null);
  });

  await t.step("can set, get, and clear fields and objects", () => {
    browserStorage = new BrowserStorage();

    browserStorage.set("one", { hello: "world" });
    browserStorage.set("2", "hello world");
    browserStorage.set("3", null);
    browserStorage.set("4");
    assertEquals(browserStorage.get("one"), { hello: "world" });
    assertEquals(browserStorage.get("2"), "hello world");
    assertEquals(browserStorage.get("3"), null);
    assertEquals(browserStorage.get("4"), null);

    browserStorage.clear();
    assertEquals(browserStorage.get("one"), null);
    assertEquals(browserStorage.get("2"), null);
    assertEquals(browserStorage.get("3"), null);
    assertEquals(browserStorage.get("4"), null);
  });

  await t.step("namespaces storage", () => {
    const stubStorage = new MemoryStorageProvider();
    browserStorage = new BrowserStorage({ prefix: "@testing:", adapter: stubStorage });

    stubStorage.setItem("1", "the wrong value");
    browserStorage.set("1", "the correct value");

    assertEquals(stubStorage.getItem("1"), "the wrong value");
    assertEquals(browserStorage.get("1"), "the correct value");
    assertEquals(stubStorage.getItem("@testing:1"), "the correct value");
  });

  await t.step("catches error", () => {
    const stubStorage = new MemoryStorageProvider();
    browserStorage = new BrowserStorage({ adapter: stubStorage });

    const throwable = () => {
      throw new Error();
    };
    JSON.parse = throwable;
    stubStorage.setItem = throwable;

    browserStorage.set("1", "hello world");
    assertEquals(browserStorage.get("1"), null);
  });
});
