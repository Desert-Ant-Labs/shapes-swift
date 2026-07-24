# Shapes

On-device single-stroke shape recognition for Swift, Android, and JavaScript. Draw one stroke and Shapes turns it into a clean vector shape: a line, rectangle, triangle, ellipse, or star. Everything runs locally, so the stroke never leaves the device or browser.

A small classifier proposes a shape, a geometric fitter produces the clean parameters, and the stroke is accepted only if it clears that class's calibrated gate. The result snaps to nice axes, circles, squares, and 15° rotations.

```text
✎  a wobbly hand-drawn box   ->   Shape.rectangle(corners: [...])   clean and axis-aligned
```

- [Features](#features)
- [Swift](#swift)
  - [Install](#install)
  - [Usage](#usage)
  - [Example](#example)
- [Android](#android)
  - [Install](#install-1)
  - [Usage](#usage-1)
  - [Example](#example-1)
- [JavaScript and TypeScript](#javascript-and-typescript)
  - [Install](#install-2)
  - [Usage](#usage-2)
  - [Example](#example-2)
- [Shapes](#shapes-1)
- [Model and caching](#model-and-caching)
- [License](#license)

## Features

- Runs fully on device or in the local runtime. The stroke never leaves the machine.
- Recognizes `line`, `rectangle`, `triangle`, `ellipse`, and `star`, and rejects scribbles.
- Fits clean vector geometry and snaps it to axes, circles, squares, and 15° rotations.
- One and the same recognition pipeline on every platform, so results match: Core ML on Apple, LiteRT on Android and Linux, LiteRT.js in the browser.
- Small model bundled by default (about 0.2 MB on Apple, ~1.3 MB LiteRT), with explicit-directory download/adopt still available; recognition is typically a few milliseconds.
- Apple bonus: one-line live snapping on a PencilKit canvas with an undo-safe preview.

## Swift

### Install

Requirements: iOS 16+, macOS 13+, tvOS 16+, watchOS 9+, visionOS 1+, and Swift 5.9+.

Add Shapes with Swift Package Manager:

```swift
.package(url: "https://github.com/Desert-Ant-Labs/shapes.git", from: "0.7.0")
```

Then add the `Shapes` product to your app target. Live PencilKit snapping is part of the `Shapes` product.

The Core ML model is bundled by default because Shapes is small. `ShapesCoreMLResources` remains available for explicit bundle construction and tests. SwiftPM consumers who prefer on-demand download or an explicit model directory can disable the default `BundledModel` trait:

```swift
.package(url: "https://github.com/Desert-Ant-Labs/shapes.git", from: "0.7.0", traits: [])
```

With the trait disabled, `Shapes()` downloads on demand and `Shapes(directory:)` loads from or downloads into your chosen directory.

### Usage

Create one `Shapes` and reuse it. Construction is cheap and non-blocking. The model loads on first use, or earlier if you call `download`.

```swift
import Shapes

let shapes = Shapes()
if let shape = try await shapes.recognize(points: strokePoints) {
    switch shape {
    case let .rectangle(corners): ...       // [Point]
    case let .ellipse(center, semiMajor, semiMinor, rotation): ...
    default: break
    }
}
```

`recognize` accepts `[Point]` or, on Apple platforms, `[CGPoint]` and PencilKit `PKStroke`. On Apple, `Shape.path` gives a renderable `CGPath`.

Choose where the model comes from:

```swift
let shapes = Shapes()                       // bundled model by default
let shapes = Shapes(directory: myModelDir)  // explicit model directory
let shapes = Shapes(bundle: myBundle)       // bundled model resources
```

Download ahead of time, for example from an onboarding screen:

```swift
let shapes = Shapes()
if !shapes.isDownloaded() {
    try await shapes.download { fraction in
        print("\(Int(fraction * 100))%")
    }
}
```

Bundle the model in an Apple app:

```swift
import Shapes
import ShapesCoreMLResources

let shapes = Shapes(bundle: ShapesCoreMLResourcesBundle.bundle)
```

Live PencilKit snapping (iOS/visionOS):

```swift
import Shapes

canvasView.enableShapeSnapping()   // pause while drawing to preview; lift to snap
// Offline/instant: enableShapeSnapping(using: Shapes(bundle: ShapesCoreMLResourcesBundle.bundle))
```

### Example

[SwiftUI example app](Examples/ShapesSwiftExample)

## Android

### Install

Requirements: Android API 24+. The AAR contains prebuilt arm64-v8a and x86_64 native libraries.

Shapes is published to Maven Central.

```kotlin
// settings.gradle.kts
dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
    }
}

// build.gradle.kts
dependencies {
    implementation("ai.desertant:shapes:0.4.6")
}
```

`ai.desertant:shapes` bundles the small LiteRT model by default, so normal installs work offline. To disable bundling, exclude the transitive resources artifact:

```kotlin
dependencies {
    implementation("ai.desertant:shapes:0.4.6") {
        exclude(group = "ai.desertant", module = "shapes-tflite-resources")
    }
}
```

With that exclusion, `Shapes(context)` downloads on demand and caches the model. `Shapes(context, directory = modelDir)` loads from or downloads into your chosen directory.

### Usage

```kotlin
import ai.desertant.shapes.Point
import ai.desertant.shapes.Shapes

val shapes = Shapes(context)                 // bundled model by default
val shape = shapes.recognize(strokePoints)   // Shape? (null if rejected)
when (shape) {
    is Shapes.Rectangle -> shape.corners
    is Shapes.Ellipse -> shape.center
    else -> {}
}
shapes.close()
```

`recognize` and `download` are `suspend` functions. Use `use` to close the native handle automatically:

```kotlin
Shapes(context).use { shapes ->
    val shape = shapes.recognize(strokePoints)
}
```

Download before first use:

```kotlin
val shapes = Shapes(context)
if (!shapes.isDownloaded()) {
    shapes.download()
}
```

Use an explicit model directory or bundled resources:

```kotlin
val cached = Shapes(context)                         // managed cache
val explicit = Shapes(context, directory = modelDir) // explicit model directory
val offline = Shapes.bundled()                       // explicit bundled constructor
```

### Example

[Android example app](Examples/ShapesAndroidExample)

## JavaScript and TypeScript

### Install

Two entries share one `Shapes` API. The default `@desert-ant-labs/shapes` is the browser build (WebAssembly + LiteRT.js); it has no native dependencies, so it bundles cleanly for every target of a multi-target bundler (Next.js, Remix, SvelteKit, Nuxt), including the browser bundle and the Client-Component SSR pass those frameworks render in Node. `@desert-ant-labs/shapes/native` is a prebuilt native core for server-side inference in Node.

```bash
# Browser (default entry):
npm i @desert-ant-labs/shapes @litertjs/core

# Server-side inference in Node (/native entry) needs no extra install:
npm i @desert-ant-labs/shapes
```

The default import is safe to *import* during server-side rendering, but LiteRT.js initializes only in a browser or Web Worker, so `Shapes.load()` runs inference in the browser; in plain Node it throws an actionable error pointing you to `@desert-ant-labs/shapes/native`. The native build ships for linux-x64, linux-arm64 (LiteRT), and darwin-arm64 (Core ML); other platforms fall back to a clear error, so use the Swift package or a browser there.

### Usage

```ts
import { Shapes } from "@desert-ant-labs/shapes";     // browser; use "@desert-ant-labs/shapes/native" server-side

const shapes = await Shapes.load();               // downloads + caches on first use
const shape = await shapes.recognize(points);     // [{x, y}, ...] or [x0, y0, ...]
if (shape?.kind === "ellipse") shape.center;
```

For server-side inference, import the same API from the native subpath:

```ts
import { Shapes } from "@desert-ant-labs/shapes/native";   // server only
```

Unlike the Swift and Android packages, the JavaScript package does not bundle the
model: `Shapes.load()` downloads it from the Hugging Face Hub at the SDK's pinned
tag on first use and caches it (the OS cache dir for the native build, the fetch
cache in the browser). To self-host or run offline, pass `directory` (native
build) or `modelBaseUrl` (browser):

```js
const shapes = await Shapes.load({
  directory: "/var/cache/shapes",       // native build: adopt/download files here
  modelBaseUrl: "/assets/shapes/",      // browser: serve the files yourself
  onProgress: (fraction) => console.log(fraction),
});
```

Bring your own LiteRT.js module (browser), useful for bundlers and React Native:

```js
import * as litert from "@litertjs/core";
import { Shapes } from "@desert-ant-labs/shapes";

const shapes = await Shapes.load({ litert, litertWasmDir: "/path/to/@litertjs/core/wasm/" });
```

### Example

[JavaScript examples](Examples/ShapesWasmExample)

## Shapes

All platforms return the same shape, discriminated by kind, or `null` when the stroke is rejected or degenerate:

- `line(from, to)`
- `rectangle(corners)` - four points around the perimeter
- `triangle(vertices)` - three vertices
- `ellipse(center, semiMajor, semiMinor, rotation)` - `rotation` in radians
- `star(center, outerRadius, innerRadius, rotation, pointCount)`

The field names and shape kinds are identical across Swift, Kotlin, and TypeScript. `minimumConfidence` (default `0`) raises the classifier threshold on top of each class's calibrated gate.

## Model and caching

The model artifacts are published at [`desert-ant-labs/shapes`](https://huggingface.co/desert-ant-labs/shapes) on Hugging Face. Each SDK pins the model revision to its own package version, and downloads are SHA-256 verified.

Default behavior:

- Swift: bundles the Core ML model by default, with explicit-directory download/adopt still available.
- Android: bundles the LiteRT model by default through the normal `ai.desertant:shapes` dependency.
- JavaScript: downloads the model from Hugging Face on `Shapes.load()` and caches it; the browser build (`@desert-ant-labs/shapes`) runs LiteRT.js, and the native build (`@desert-ant-labs/shapes/native`) runs LiteRT on Linux and Core ML on macOS for server-side Node. The native build uses `directory` and the browser uses `modelBaseUrl` for self-hosted or offline files.

Passing an explicit `directory` makes that directory the model home. Existing valid files are adopted for offline use; otherwise Shapes downloads into that directory and reuses it later.

## License

[Desert Ant Labs Source-Available License](https://license.desertant.com/1.0). Free for
most apps; a commercial license is required at scale. Full terms are at the link.
Licensing: <licensing@desertant.com>.
