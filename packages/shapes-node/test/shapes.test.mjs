// The shapes-node test suite. Runs server-side in Node against the native core
// (the `@desert-ant-labs/shapes/native` entry, i.e. node.js), with model files
// loaded from the local LiteRT resources instead of the Hugging Face Hub. The
// default universal WebAssembly + LiteRT.js entry is exercised by the
// headless-Chromium example.
import assert from "node:assert/strict";
import { test } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Shapes } from "../node.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const directory = path.join(here, "../../../Sources/ShapesTFLiteResources/Resources");

let shapes;
let loadError;
try {
  shapes = await Shapes.load({ directory });
} catch (e) {
  loadError = e;
}
const modelOpts = shapes ? {} : { skip: `native model unavailable: ${String(loadError).slice(0, 100)}` };

function circle(cx, cy, r, n = 64) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = (2 * Math.PI * i) / n;
    pts.push({ x: cx + r * Math.cos(t), y: cy + r * Math.sin(t) });
  }
  return pts;
}

test("recognizes a circle as an ellipse", modelOpts, async () => {
  const shape = await shapes.recognize(circle(100, 100, 80));
  assert.ok(shape, "expected a shape");
  assert.equal(shape.kind, "ellipse");
});

test("recognizes a line", modelOpts, async () => {
  const pts = Array.from({ length: 41 }, (_, i) => ({ x: i * 5, y: i * 2 }));
  const shape = await shapes.recognize(pts);
  assert.equal(shape.kind, "line");
});

test("recognizes a rectangle and returns four corners", modelOpts, async () => {
  const rect = [];
  for (let x = 0; x <= 200; x += 8) rect.push({ x, y: 0 });
  for (let y = 0; y <= 120; y += 8) rect.push({ x: 200, y });
  for (let x = 200; x >= 0; x -= 8) rect.push({ x, y: 120 });
  for (let y = 120; y >= 0; y -= 8) rect.push({ x: 0, y });
  const shape = await shapes.recognize(rect);
  assert.equal(shape.kind, "rectangle");
  assert.equal(shape.corners.length, 4);
});

test("accepts a flat number array", modelOpts, async () => {
  const flat = circle(50, 50, 40).flatMap((p) => [p.x, p.y]);
  const shape = await shapes.recognize(flat);
  assert.equal(shape.kind, "ellipse");
});

test("degenerate stroke returns null", modelOpts, async () => {
  const shape = await shapes.recognize([{ x: 1, y: 1 }]);
  assert.equal(shape, null);
});
