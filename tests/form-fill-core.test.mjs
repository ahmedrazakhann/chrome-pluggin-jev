import assert from "node:assert/strict";
import test from "node:test";

import {
  isProtectedMetadata,
  isSelectPlaceholder,
  normalizeFillValue,
} from "../extension/src/form-fill-core.mjs";
import { selectFrames } from "../extension/src/frame-targeting.mjs";

test("protected metadata blocks credentials and payment fields", () => {
  assert.equal(isProtectedMetadata({ type: "password", label: "Password" }), true);
  assert.equal(isProtectedMetadata({ type: "text", autocomplete: "cc-number" }), true);
  assert.equal(isProtectedMetadata({ type: "text", label: "One-time verification code" }), true);
  assert.equal(isProtectedMetadata({ type: "email", label: "Consignee email" }), false);
});

test("fill values are exact deterministic strings", () => {
  assert.equal(normalizeFillValue(false), "false");
  assert.equal(normalizeFillValue(12.5), "12.5");
  assert.equal(normalizeFillValue("Acme Trading LLC"), "Acme Trading LLC");
  assert.equal(normalizeFillValue(null), "");
});

test("select placeholders are empty even when the browser value is zero", () => {
  assert.equal(isSelectPlaceholder({ label: "[Please Select]", value: "0" }), true);
  assert.equal(isSelectPlaceholder({ label: "[Select Declaration Type]", value: "0" }), true);
  assert.equal(isSelectPlaceholder({ label: "Please choose a port", value: "0" }), true);
  assert.equal(isSelectPlaceholder({ label: "Import", value: "1" }), false);
  assert.equal(isSelectPlaceholder({ label: "Zero-rated", value: "0" }), false);
});

test("exact frame policy selects only the declared cross-origin frame", () => {
  const frames = [
    { frameId: 0, parentFrameId: -1, documentId: "top", url: "https://eservices.dubaitrade.ae/home" },
    { frameId: 27, parentFrameId: 0, documentId: "form", url: "https://mirsal2new.dubaitrade.ae/declaration" },
    { frameId: 31, parentFrameId: 0, documentId: "other", url: "https://example.test/help" },
  ];
  const result = selectFrames(frames, {
    strategy: "exact",
    allowAllFrames: false,
    expectedMatches: 1,
    targets: [{ origin: "https://mirsal2new.dubaitrade.ae" }],
  });

  assert.deepEqual(result.selected.map(frame => frame.frameId), [27]);
  assert.equal(result.policy.status, "matched");
  assert.equal(result.policy.allowAllFrames, false);
});

test("frame policy mismatch never broadens the scan", () => {
  const frames = [
    { frameId: 0, url: "https://portal.test" },
    { frameId: 7, url: "https://forms.test/one" },
    { frameId: 8, url: "https://forms.test/two" },
  ];
  const result = selectFrames(frames, {
    strategy: "exact",
    allowAllFrames: false,
    expectedMatches: 1,
    targets: [{ origin: "https://forms.test" }],
  });

  assert.equal(result.policy.matchedCount, 2);
  assert.equal(result.policy.status, "mismatch");
  assert.deepEqual(result.selected, []);
});

test("all-frame strategy requires explicit authorization", () => {
  assert.throws(
    () => selectFrames([], {
      strategy: "all",
      allowAllFrames: false,
      expectedMatches: 1,
      targets: [],
    }),
    /not authorized/,
  );
});
