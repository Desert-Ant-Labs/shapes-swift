# @desert-ant-labs/shapes

On-device single-stroke shape recognition for JavaScript. Turns one hand-drawn
stroke into a clean line, rectangle, triangle, ellipse, or star, fully locally.

Two entries share one `Shapes` API:

- **`@desert-ant-labs/shapes`** (default): a WebAssembly pipeline with
  [LiteRT.js](https://www.npmjs.com/package/@litertjs/core) inference, for the
  **browser**. It has no native dependencies, so a single import builds cleanly
  for every target of a multi-target bundler (Next.js, Remix, SvelteKit, Nuxt),
  including the browser bundle and the Client-Component SSR pass those frameworks
  render in Node. It is safe to *import* during server-side rendering, but
  LiteRT.js needs a browser (or Web Worker) to initialize, so `Shapes.load()`
  runs inference only in the browser; calling it in plain Node throws an
  actionable error pointing you to `/native`.
- **`@desert-ant-labs/shapes/native`**: a prebuilt native core (LiteRT on Linux,
  Core ML on macOS), for **server-side inference** in Node. No `@litertjs/core`,
  no build tools, no flags. Import it from server-only code (API routes, server
  actions, plain Node scripts). Do not import it from a component that also
  renders in the browser.

```bash
# Browser (default entry):
npm i @desert-ant-labs/shapes @litertjs/core

# Server-side inference in Node (/native entry) needs no extra install:
npm i @desert-ant-labs/shapes
```

The model is **downloaded from the Hugging Face Hub on first use** (at the SDK's
pinned tag) and then cached, so nothing model-sized is shipped in the npm
tarball; see [Loading the model](#loading-the-model) for the self-host / offline
opt-outs.

```js
import { Shapes } from "@desert-ant-labs/shapes";

const shapes = await Shapes.load();            // downloads + caches on first use
const shape = await shapes.recognize(points);  // points: [{x, y}, ...] or [x0, y0, ...]

if (shape?.kind === "rectangle") {
  shape.corners;   // four {x, y} points
}
shapes.dispose();  // frees native resources in the /native build; no-op otherwise
```

Server-only code that wants the native core imports the same API from the
`/native` subpath:

```js
import { Shapes } from "@desert-ant-labs/shapes/native"; // server only
```

### Loading the model

By default `Shapes.load()` downloads this platform's model files from the Hugging
Face Hub ([`desert-ant-labs/shapes`](https://huggingface.co/desert-ant-labs/shapes))
at the SDK's pinned tag, verifies them (SHA-256), and caches them (the OS cache
dir for the native build, the browser's fetch cache in the browser), so it loads
once and runs offline afterward. The native build fetches the `.tflite` (LiteRT)
on Linux and the `.mlmodelc/` (Core ML) on macOS; the browser fetches the
`.tflite` for LiteRT.js.

To self-host or run fully offline, opt out of the Hub:

- `directory`: an explicit model directory (native build, or the browser build
  under Node). Files already there are used offline; otherwise the model is
  downloaded into it.
- `modelBaseUrl`: a base URL you serve the model files from (e.g.
  `"/assets/shapes/"`), loaded instead of the Hub (browser build).

`Shapes.load()` also accepts:

- `cacheRoot`: base directory for the managed on-disk cache (default `~/.cache`;
  native build, or the browser build under Node).
- `onProgress`: load/download progress callback, fraction in `[0, 1]`.
- Browser-only: `litert` (bring-your-own `@litertjs/core`), `litertWasmDir`
  (URL/path to the LiteRT.js Wasm directory; defaults to the installed package,
  or the jsDelivr CDN), and `accelerator` (`"wasm"` XNNPACK CPU default,
  `"webgpu"`, or `"webnn"`).

`recognize(points, options?)` returns a `Shape` (discriminated by `kind`:
`"line"`, `"rectangle"`, `"triangle"`, `"ellipse"`, `"star"`) or `null` when the
stroke is rejected or degenerate. `options.minimumConfidence` (default `0`)
raises the classifier threshold on top of each class's calibrated gate.

### Bundlers and SSR

The default `@desert-ant-labs/shapes` import is safe to use directly in
components: it is pure JavaScript + WebAssembly with no native modules, so
bundlers can build it for the browser and for the Node SSR pass from the same
module graph with no configuration.

The `@desert-ant-labs/shapes/native` subpath loads a native addon (via `koffi`)
and is for server-only code. If you import it inside a framework that bundles
server code (for example a Next.js Route Handler or Server Action), mark it
external so the bundler does not try to bundle the native binary. In Next.js:

```js
// next.config.js
module.exports = { serverExternalPackages: ["@desert-ant-labs/shapes"] };
```

### Platforms

The native server build (`/native`) ships for **linux-x64**, **linux-arm64**
(LiteRT), and **darwin-arm64** (Core ML). Other platforms fall back to a clear
error at `load()`; use the default WebAssembly build, the Swift package, or a
browser for those. The browser build runs anywhere with WebAssembly.
