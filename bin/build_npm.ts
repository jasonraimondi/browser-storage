import { build, emptyDir } from "https://deno.land/x/dnt@0.37.0/mod.ts";

await emptyDir("./npm");

Deno.copyFileSync("npm-deprecated.js", "npm/npm-deprecated.js");

await build({
  test: false,
  packageManager: "pnpm",
  entryPoints: ["./mod.ts", "./npm-deprecated.js"],
  outDir: "./npm",
  shims: {
    deno: true,
  },
  compilerOptions: {
    lib: ["DOM", "ESNEXT"],
  },
  package: {
    name: "@jmondi/browser-storage",
    version: Deno.args[0]?.replace("v", ""),
    description: "Utilities for local and session browser storage.",
    scripts: {
      "postinstall": "node npm-deprecated.js",
    },
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
    Deno.writeFileSync(
      "./npm/README.md",
      new TextEncoder().encode(
        "# @jmondi/browser-storage\n\nThis package is deprecated, please use https://jsr.io/@jmondi/browser-storage instead.\n",
      ),
    );
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
