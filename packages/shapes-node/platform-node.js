// Node half of the platform seam for the universal WebAssembly entry
// (browser.js) when it runs server-side, e.g. the Client-Component SSR pass a
// framework renders in Node. Every node-only import (node:fs, node:worker_threads
// via the WASI shim, ...) lives here. Bundlers resolve this file only through the
// non-browser ("default") condition of `#platform`, so the browser bundle never
// sees `node:*` and never tries to chunk the WASI/worker_threads code.

// Instantiate the wasm core under Node (WASI shim) and hand back its exports.
export async function setupCore() {
  globalThis.__ShapesHost ??= {};
  const { instantiate } = await import("./dist/instantiate.js");
  // Give the Swift ModelStore node's fs as a platform seam (no `require` under
  // the WASI shim); the download/verify/cache logic stays in Swift.
  const fsmod = await import("node:fs");
  globalThis.__DalNodeFS = {
    existsSync: fsmod.existsSync, statSync: fsmod.statSync,
    // Copy into an exact-length Uint8Array: node returns pooled Buffers for
    // small files whose .buffer is the whole shared pool, which JavaScriptKit
    // would over-read when marshalling into wasm memory.
    readFileSync: (p) => new Uint8Array(fsmod.readFileSync(p)),
    writeFileSync: fsmod.writeFileSync,
    mkdirSync: fsmod.mkdirSync, renameSync: fsmod.renameSync, unlinkSync: fsmod.unlinkSync,
  };
  const { defaultNodeSetup } = await import("./dist/platforms/node.js");
  await instantiate(await defaultNodeSetup({}));
  return globalThis.__ShapesExports;
}

// Serve LiteRT.js's own Wasm runtime straight from the installed package.
// Package layout: <root>/dist/index.js and <root>/wasm/. Walk up from the
// resolved entry to the package root, then point at wasm/.
export async function defaultWasmDir() {
  const { createRequire } = await import("node:module");
  const { pathToFileURL } = await import("node:url");
  const path = await import("node:path");
  const fs = await import("node:fs");
  const require = createRequire(import.meta.url);
  let dir = path.dirname(require.resolve("@litertjs/core"));
  for (let i = 0; i < 4 && !fs.existsSync(path.join(dir, "wasm")); i++) {
    dir = path.dirname(dir);
  }
  return pathToFileURL(path.join(dir, "wasm") + "/").href;
}

// The wasm host hands createSession a cached file path under Node; read it into
// an owned Uint8Array before compiling.
export async function readModelSource(source) {
  if (typeof source === "string") {
    const fs = await import("node:fs");
    return new Uint8Array(fs.readFileSync(source));
  }
  return source;
}

// Base for the managed nested cache under Node: ~/.cache.
export async function defaultCacheRoot() {
  const os = await import("node:os");
  const path = await import("node:path");
  return path.join(os.homedir(), ".cache");
}
