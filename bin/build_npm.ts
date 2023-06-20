import { build, emptyDir } from "https://deno.land/x/dnt@0.37.0/mod.ts";

await emptyDir("./npm");

await build({
  test: false,
  packageManager: "pnpm",
  entryPoints: ["./mod.ts"],
  outDir: "./npm",
  shims: {
    deno: true,
  },
  compilerOptions: {
    lib: ["DOM", "ES2021"],
  },
  package: {
    name: "@jmondi/browser-storage",
    version: Deno.args[0]?.replace("v", ""),
    description: "Utilities for local and session browser storage.",
    keywords: [
      "browser-storage",
      "local-storage",
      "session-storage",
      "web storage",
      "localStorage",
      "sessionStorage",
      "in-memory storage",
      "serialization",
      "key-value storage",
      "JavaScript",
      "TypeScript",
      "storage management",
    ],
    author: "Jason Raimondi <jason@raimondi.us>",
    license: "MIT",
    engines: {
      node: ">=18.0.0",
    },
    repository: {
      type: "git",
      url: "git+https://github.com/jasonraimondi/browser-storage.git",
    },
    bugs: {
      url: "https://github.com/jasonraimondi/browser-storage/issues",
    },
  },
  postBuild() {
    Deno.copyFileSync("LICENSE", "npm/LICENSE");
    Deno.copyFileSync("README.md", "npm/README.md");
  },
});

// ensure the test data is ignored in the `.npmignore` file
// so it doesn't get published with your npm package
await Deno.writeTextFile(
  "npm/.npmignore",
  "esm/testdata/\nscript/testdata/\n",
  { append: true },
);

// post build steps
