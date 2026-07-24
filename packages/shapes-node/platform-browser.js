// Browser half of the platform seam for the universal WebAssembly entry
// (browser.js). Bundlers resolve this file through the "browser" import
// condition of `#platform` (see package.json "imports"), so none of the
// node-only code in platform-node.js ever enters the browser module graph.
// This is what lets one `@desert-ant-labs/shapes` import build cleanly for the
// browser target of multi-target bundlers (Next, Remix, SvelteKit, Nuxt).

// Instantiate the wasm core and hand back its exports.
export async function setupCore() {
  globalThis.__ShapesHost ??= {};
  const { init } = await import("./dist/index.js");
  await init({});
  return globalThis.__ShapesExports;
}

// Where LiteRT.js loads its own Wasm runtime from. In the browser we default to
// the jsDelivr mirror of the package's wasm/ directory.
export async function defaultWasmDir() {
  return "https://cdn.jsdelivr.net/npm/@litertjs/core/wasm/";
}

// In the browser the model "source" is already the model bytes.
export async function readModelSource(source) {
  return source;
}

// No managed on-disk cache in the browser; the runtime caches in the browser
// (Cache API / IndexedDB) with an empty base.
export async function defaultCacheRoot() {
  return "";
}
