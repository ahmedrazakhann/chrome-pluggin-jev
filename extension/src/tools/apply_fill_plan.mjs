import {
  PROTECTED_FIELD_PATTERN_SOURCE,
  SELECT_PLACEHOLDER_PATTERN_SOURCE,
  normalizeFillValue,
} from "../form-fill-core.mjs";
import * as snapshots from "../form-snapshots.mjs";

async function applyFrame(
  snapshotId,
  expectedUrl,
  assignments,
  protectedSource,
  selectPlaceholderSource,
  settleMs,
  maxWaitMs,
) {
  if (location.href !== expectedUrl) {
    return { status: "stale", filled: 0, changed: true, results: [], reason: "frame URL changed" };
  }
  const protectedPattern = new RegExp(protectedSource, "i");
  const selectPlaceholderPattern = new RegExp(selectPlaceholderSource, "i");
  const marker = "data-twenty-form-fill-ref";
  const roots = [];
  const seen = new Set();
  const addRoot = root => {
    if (!root || seen.has(root)) return;
    seen.add(root);
    roots.push(root);
    for (const element of root.querySelectorAll("*")) {
      if (element.shadowRoot) addRoot(element.shadowRoot);
      if (element.tagName === "IFRAME") {
        try { addRoot(element.contentDocument); } catch { /* cross-origin child */ }
      }
    }
  };
  addRoot(document);
  const find = fieldId => {
    const wanted = snapshotId + ":" + fieldId;
    for (const root of roots) {
      for (const element of root.querySelectorAll("[" + marker + "]")) {
        if (element.getAttribute(marker) === wanted) return element;
      }
    }
    return null;
  };
  const text = value => String(value || "").replace(/\s+/g, " ").trim();
  const labelledBy = element => text(
    (element.getAttribute("aria-labelledby") || "")
      .split(/\s+/)
      .filter(Boolean)
      .map(id => element.ownerDocument.getElementById(id)?.textContent)
      .filter(Boolean)
      .join(" "),
  );
  const labelFor = element => text([
    element.getAttribute("aria-label"),
    labelledBy(element),
    ...Array.from(element.labels || [], label => label.textContent),
    element.getAttribute("placeholder"), element.getAttribute("name"), element.id,
  ].filter(Boolean).join(" "));
  const sectionFor = element => {
    const fieldset = element.closest("fieldset");
    const form = element.closest("form, [role=form], [role=dialog], dialog");
    return text(
      fieldset?.querySelector(":scope > legend")?.textContent ||
      form?.querySelector("h1, h2, h3, [role=heading]")?.textContent ||
      form?.getAttribute("aria-label") || element.ownerDocument.title,
    ).slice(0, 200);
  };
  const fingerprintFor = element => {
    const view = element.ownerDocument.defaultView;
    const isInput = element instanceof view.HTMLInputElement;
    const isSelect = element instanceof view.HTMLSelectElement;
    const inputType = isInput ? (element.type || "text").toLowerCase() :
      isSelect ? "select" : element.isContentEditable ? "contenteditable" : element.tagName.toLowerCase();
    const options = isSelect ? Array.from(element.options, option => ({
      value: text(option.value).slice(0, 200),
      label: text(option.textContent).slice(0, 200),
    })).slice(0, 100) : [];
    return JSON.stringify([
      element.tagName.toLowerCase(), inputType, labelFor(element).slice(0, 240),
      text(element.getAttribute("name")).slice(0, 160),
      text(element.getAttribute("id")).slice(0, 160),
      text(element.getAttribute("placeholder")).slice(0, 200),
      text(element.getAttribute("autocomplete")).slice(0, 160),
      sectionFor(element), options,
    ]);
  };
  const isProtected = element => protectedPattern.test([
    element.type, labelFor(element), element.name, element.id,
    element.autocomplete, element.placeholder,
  ].filter(Boolean).join(" "));
  const read = element => {
    if (element.tagName === "SELECT") {
      const option = element.selectedOptions[0];
      if (!option || option.disabled || !text(element.value) ||
          selectPlaceholderPattern.test(text(option.textContent))) return "";
    }
    return element.isContentEditable ? text(element.innerText) : text(element.value);
  };
  const write = (element, value) => {
    const view = element.ownerDocument.defaultView;
    if (element.isContentEditable) {
      element.focus();
      const selection = element.ownerDocument.getSelection();
      const range = element.ownerDocument.createRange();
      range.selectNodeContents(element);
      selection.removeAllRanges();
      selection.addRange(range);
      if (!element.ownerDocument.execCommand("insertText", false, value)) {
        throw new Error("contenteditable rejected the value");
      }
      return;
    }
    if (element instanceof view.HTMLSelectElement) {
      const wanted = value.toLocaleLowerCase();
      const option = Array.from(element.options).find(item =>
        text(item.value).toLocaleLowerCase() === wanted ||
        text(item.textContent).toLocaleLowerCase() === wanted,
      );
      if (!option) throw new Error("no matching select option");
      if (option.disabled || selectPlaceholderPattern.test(text(option.textContent))) {
        throw new Error("placeholder select option is not fillable");
      }
      element.value = option.value;
    } else {
      const prototype = element instanceof view.HTMLTextAreaElement ?
        view.HTMLTextAreaElement.prototype : view.HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
      if (setter) setter.call(element, value);
      else element.value = value;
    }
    element.dispatchEvent(new view.InputEvent("input", {
      bubbles: true,
      inputType: "insertText",
      data: value,
    }));
    element.dispatchEvent(new view.Event("change", { bubbles: true }));
  };

  let mutationCount = 0;
  let quietTimer;
  const quiet = new Promise(resolve => {
    const finish = () => { observer.disconnect(); clearTimeout(quietTimer); resolve(); };
    const observer = new MutationObserver(mutations => {
      mutationCount += mutations.length;
      clearTimeout(quietTimer);
      quietTimer = setTimeout(finish, settleMs);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
    quietTimer = setTimeout(finish, settleMs);
    setTimeout(finish, maxWaitMs);
  });

  const results = [];
  const expected = new Map();
  for (const assignment of assignments) {
    const element = find(assignment.fieldId);
    if (!element || !element.isConnected) {
      results.push({ fieldId: assignment.fieldId, status: "stale", reason: "field replaced or removed" });
      continue;
    }
    if (isProtected(element)) {
      results.push({ fieldId: assignment.fieldId, status: "skipped", reason: "protected field" });
      continue;
    }
    if (element.getAttribute("role") === "combobox" && element.tagName !== "SELECT") {
      results.push({ fieldId: assignment.fieldId, status: "skipped", reason: "custom dropdown requires option selection" });
      continue;
    }
    if (assignment.fieldFingerprint && fingerprintFor(element) !== assignment.fieldFingerprint) {
      results.push({ fieldId: assignment.fieldId, status: "stale", reason: "field metadata changed" });
      continue;
    }
    if (element.disabled || element.readOnly || !element.getClientRects().length ||
        element.closest("[hidden], [inert], [aria-hidden=true]")) {
      results.push({ fieldId: assignment.fieldId, status: "skipped", reason: "field unavailable" });
      continue;
    }
    if (read(element) !== String(assignment.beforeValue || "").trim() || read(element)) {
      results.push({ fieldId: assignment.fieldId, status: "stale", reason: "field value changed" });
      continue;
    }
    try {
      write(element, String(assignment.value));
      expected.set(assignment.fieldId, element.tagName === "SELECT" ? read(element) : text(assignment.value));
      results.push({
        fieldId: assignment.fieldId,
        candidateId: assignment.candidateId,
        status: read(element) ? "filled" : "failed",
        reason: read(element) ? undefined : "value was not retained",
      });
    } catch (error) {
      results.push({ fieldId: assignment.fieldId, status: "failed", reason: error.message });
    }
  }
  await quiet;
  await new Promise(resolve => setTimeout(resolve, 1000));
  for (const result of results) {
    if (!expected.has(result.fieldId)) continue;
    const element = find(result.fieldId);
    if (!element?.isConnected || read(element) !== expected.get(result.fieldId) || !read(element) ||
        element.getAttribute("aria-invalid") === "true" || element.validity?.valid === false) {
      result.status = "failed";
      result.reason = "expected value was rejected, reset or invalid after settling";
    }
  }
  const filled = results.filter(item => item.status === "filled").length;
  const stale = results.some(item => item.status === "stale");
  return {
    status: stale && !filled ? "stale" : "applied",
    filled,
    mutationCount,
    changed: mutationCount > 0,
    results,
  };
}

export default async function run(ctx, args = {}) {
  const tabId = ctx.tabId;
  if (tabId == null) throw new Error("apply_fill_plan requires a target tab");
  const snapshot = snapshots.getSnapshot(tabId);
  const snapshotId = String(args.snapshotId || "");
  if (!snapshot || snapshot.snapshotId !== snapshotId) {
    return { status: "stale", filled: 0, changed: true, results: [], reason: "snapshot is no longer current" };
  }
  const requested = Array.isArray(args.assignments) ? args.assignments.slice(0, 50).map(item => ({
    fieldId: String(item.fieldId || ""),
    candidateId: String(item.candidateId || ""),
    beforeValue: String(item.beforeValue || ""),
    fieldFingerprint: String(item.fieldFingerprint || ""),
    value: normalizeFillValue(item.value),
  })) : [];
  const settleMs = Math.min(Math.max(Number(args.settleMs) || 250, 50), 2_000);
  const maxWaitMs = Math.min(Math.max(Number(args.maxWaitMs) || 3_000, settleMs), 10_000);
  const currentFrames = await chrome.webNavigation.getAllFrames({ tabId }) || [];
  const currentById = new Map(currentFrames.map(frame => [frame.frameId, frame]));
  const fieldById = new Map(snapshot.fields.map(field => [field.fieldId, field]));
  const groups = new Map();
  const results = [];

  for (const assignment of requested) {
    const field = fieldById.get(assignment.fieldId);
    if (!field || !Number.isInteger(field.frameId)) {
      results.push({ fieldId: assignment.fieldId, status: "stale", reason: "field frame is unknown" });
      continue;
    }
    const current = currentById.get(field.frameId);
    if (!current || (field.documentId && current.documentId && field.documentId !== current.documentId)) {
      results.push({ fieldId: assignment.fieldId, status: "stale", reason: "frame document changed" });
      continue;
    }
    if (!groups.has(field.frameId)) groups.set(field.frameId, []);
    groups.get(field.frameId).push(assignment);
  }

  let mutationCount = 0;
  let changed = false;
  for (const [frameId, assignments] of groups) {
    const frame = snapshot.frames.find(item => item.frameId === frameId);
    if (!frame) {
      results.push(...assignments.map(item => ({
        fieldId: item.fieldId,
        status: "stale",
        reason: "frame snapshot is missing",
      })));
      continue;
    }
    const injected = await chrome.scripting.executeScript({
      target: { tabId, frameIds: [frameId] },
      world: "ISOLATED",
      func: applyFrame,
      args: [
        snapshotId,
        frame.url,
        assignments,
        PROTECTED_FIELD_PATTERN_SOURCE,
        SELECT_PLACEHOLDER_PATTERN_SOURCE,
        settleMs,
        maxWaitMs,
      ],
    });
    const response = injected[0]?.result;
    if (!response) throw new Error("fill plan returned no result");
    results.push(...response.results);
    mutationCount += Number(response.mutationCount || 0);
    changed ||= Boolean(response.changed);
  }

  const filled = results.filter(item => item.status === "filled").length;
  const stale = results.some(item => item.status === "stale");
  return {
    status: stale && !filled ? "stale" : "applied",
    url: snapshot.url,
    filled,
    mutationCount,
    changed,
    results,
  };
}
