import {
  AbstractStorage,
  LocalStorage,
  MemoryStorageProvider,
  SessionStorage,
  StorageConfig,
} from "./index.ts";
import { assertEquals } from "https://deno.land/std@0.175.0/testing/asserts.ts";

class TestStorage extends AbstractStorage {
  constructor(config: StorageConfig = {}, readonly adapter = new MemoryStorageProvider()) {
    super(config);
  }
}

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
  let testStorage;

  await t.step("can set and remove values", () => {
    testStorage = new TestStorage();
    testStorage.set("one", "hello world");
    assertEquals(testStorage.get("one"), "hello world");
    testStorage.remove("one");
    assertEquals(testStorage.get("one"), null);
  });

  await t.step("can set, get, and clear fields and objects", () => {
    testStorage = new TestStorage();

    testStorage.set("one", { hello: "world" });
    testStorage.set("2", "hello world");
    testStorage.set("3", null);
    testStorage.set("4");
    assertEquals(testStorage.get("one"), { hello: "world" });
    assertEquals(testStorage.get("2"), "hello world");
    assertEquals(testStorage.get("3"), null);
    assertEquals(testStorage.get("4"), null);

    testStorage.clear();
    assertEquals(testStorage.get("one"), null);
    assertEquals(testStorage.get("2"), null);
    assertEquals(testStorage.get("3"), null);
    assertEquals(testStorage.get("4"), null);
  });

  await t.step("namespaces storage", () => {
    const stubStorage = new MemoryStorageProvider();
    testStorage = new TestStorage({ prefix: "@testing:" }, stubStorage);

    stubStorage.setItem("1", "the wrong value");
    testStorage.set("1", "the correct value");

    assertEquals(stubStorage.getItem("1"), "the wrong value");
    assertEquals(testStorage.get("1"), "the correct value");
    assertEquals(stubStorage.getItem("@testing:1"), "the correct value");
  });

  await t.step("catches error", () => {
    const stubStorage = new MemoryStorageProvider();
    testStorage = new TestStorage({}, stubStorage);

    const throwable = () => {
      throw new Error();
    };
    JSON.parse = throwable;
    stubStorage.setItem = throwable;

    testStorage.set("1", "hello world");
    assertEquals(testStorage.get("1"), null);
  });
});
