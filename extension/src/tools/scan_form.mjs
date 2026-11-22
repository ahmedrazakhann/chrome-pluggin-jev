import {
  PROTECTED_FIELD_PATTERN_SOURCE,
  SELECT_PLACEHOLDER_PATTERN_SOURCE,
  makeSnapshotId,
} from "../form-fill-core.mjs";
import { selectFrames } from "../frame-targeting.mjs";
import * as snapshots from "../form-snapshots.mjs";

async function scanFrame(
  snapshotId,
  fieldPrefix,
  protectedSource,
  selectPlaceholderSource,
  settleMs,
  maxWaitMs,
) {
  const protectedPattern = new RegExp(protectedSource, "i");
  const selectPlaceholderPattern = new RegExp(selectPlaceholderSource, "i");
  const marker = "data-twenty-form-fill-ref";
  const supportedInputTypes = new Set([
    "text", "email", "tel", "url", "number", "date", "time",
    "datetime-local", "month", "week", "search", "range",
  ]);
  const comboState = element => {
    let ancestor = element.parentElement;
    for (let depth = 0; ancestor && depth < 5; depth++, ancestor = ancestor.parentElement) {
      if (ancestor.matches("form, fieldset") || ancestor.querySelectorAll('[role="combobox"]').length > 1) break;
      const inputs = [...ancestor.querySelectorAll('input[type="hidden"][name]')];
      if (inputs.length === 1) return { supported: true, value: inputs[0].value };
      if (inputs.length > 1) break;
    }
    return { supported: false, value: "" };
  };
  const waitForQuiet = async () => {
    let timer;
    await new Promise(resolve => {
      const finish = () => { observer.disconnect(); clearTimeout(timer); resolve(); };
      const observer = new MutationObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(finish, settleMs);
      });
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["disabled", "hidden", "aria-hidden", "style", "class"],
      });
      timer = setTimeout(finish, settleMs);
      setTimeout(finish, maxWaitMs);
    });
  };

  const roots = [];
  const seenRoots = new Set();
  let unsupportedFrames = 0;
  const addRoot = root => {
    if (!root || seenRoots.has(root)) return;
    seenRoots.add(root);
    roots.push(root);
    for (const element of root.querySelectorAll("*")) {
      if (element.shadowRoot) addRoot(element.shadowRoot);
      if (element.tagName === "IFRAME") {
        try {
          if (element.contentDocument) addRoot(element.contentDocument);
          else unsupportedFrames += 1;
        } catch {
          unsupportedFrames += 1;
        }
      }
    }
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
    element.getAttribute("placeholder"),
    element.getAttribute("name"),
    element.getAttribute("id"),
  ].filter(Boolean).join(" "));
  const sectionFor = element => {
    const fieldset = element.closest("fieldset");
    const form = element.closest("form, [role=form], [role=dialog], dialog");
    return text(
      fieldset?.querySelector(":scope > legend")?.textContent ||
      form?.querySelector("h1, h2, h3, [role=heading]")?.textContent ||
      form?.getAttribute("aria-label") ||
      element.ownerDocument.title,
    ).slice(0, 200);
  };
  const visible = element => {
    const view = element.ownerDocument.defaultView;
    const style = view?.getComputedStyle(element);
    return Boolean(element.getClientRects().length) && style?.display !== "none" &&
      style?.visibility !== "hidden" && !element.closest("[hidden], [inert], [aria-hidden=true]");
  };
  const currentValue = element => {
    if (element.getAttribute("role") === "combobox" && element.tagName !== "SELECT") return comboState(element).value;
    if (element.tagName === "SELECT") {
      const option = element.selectedOptions[0];
      if (!option || option.disabled || !text(element.value) ||
          selectPlaceholderPattern.test(text(option.textContent))) return "";
    }
    if (element.isContentEditable) return text(element.innerText);
    // A slider always has a value; one still at its default is unfilled.
    if (element.type === "range" && element.value === element.defaultValue) return "";
    return text(element.value);
  };
  const signatureFor = field => JSON.stringify([
    field.tag, field.inputType, field.label, field.name, field.id,
    field.placeholder, field.autocomplete, field.section, field.options,
  ]);

  await waitForQuiet();
  addRoot(document);
  for (const root of roots) {
    for (const old of root.querySelectorAll("[" + marker + "]")) old.removeAttribute(marker);
  }

  const fields = [];
  const counts = { protected: 0, unsupported: 0, hidden: 0, occupied: 0 };
  const selector = "input, textarea, select, [role=combobox], [contenteditable=true], [contenteditable=plaintext-only]";
  for (const root of roots) {
    for (const element of root.querySelectorAll(selector)) {
      const view = element.ownerDocument.defaultView;
      const isInput = element instanceof view.HTMLInputElement;
      const isSelect = element instanceof view.HTMLSelectElement;
      const isCombo = !isSelect && element.getAttribute("role") === "combobox";
      const tag = element.tagName.toLowerCase();
      const inputType = isCombo ? "combobox" : isInput ? (element.type || "text").toLowerCase() :
        isSelect ? "select" : element.isContentEditable ? "contenteditable" : tag;
      if ((!isCombo && isInput && !supportedInputTypes.has(inputType)) ||
          (!isCombo && !isInput && tag !== "textarea" && tag !== "select" && !element.isContentEditable)) {
        counts.unsupported += 1;
        continue;
      }
      if (!visible(element)) { counts.hidden += 1; continue; }
      if (isCombo && !comboState(element).supported) { counts.unsupported += 1; continue; }
      if (element.disabled || element.getAttribute("aria-disabled") === "true" || (!isCombo && element.readOnly)) {
        counts.unsupported += 1;
        continue;
      }

      const label = labelFor(element).slice(0, 240);
      const metadata = {
        type: inputType,
        label,
        name: text(element.getAttribute("name")).slice(0, 160),
        id: text(element.getAttribute("id")).slice(0, 160),
        autocomplete: text(element.getAttribute("autocomplete")).slice(0, 160),
        placeholder: text(element.getAttribute("placeholder")).slice(0, 200),
      };
      if (protectedPattern.test(Object.values(metadata).join(" "))) {
        counts.protected += 1;
        continue;
      }

      const value = currentValue(element);
      const fieldId = fieldPrefix + "-f" + (fields.length + 1);
      const options = isSelect ? Array.from(element.options, option => ({
        value: text(option.value).slice(0, 200),
        label: text(option.textContent).slice(0, 200),
      })).slice(0, 100) : [];
      const field = {
        fieldId,
        tag,
        inputType,
        label,
        name: metadata.name,
        id: metadata.id,
        autocomplete: metadata.autocomplete,
        placeholder: metadata.placeholder,
        section: sectionFor(element),
        required: Boolean(element.required || element.getAttribute("aria-required") === "true"),
        occupied: Boolean(value),
        beforeValue: value,
        options,
      };
      field.fingerprint = signatureFor(field);
      element.setAttribute(marker, snapshotId + ":" + fieldId);
      if (field.occupied) counts.occupied += 1;
      fields.push(field);
      if (fields.length >= 50) break;
    }
    if (fields.length >= 50) break;
  }

  return { url: location.href, title: document.title, fields, counts, unsupportedFrames };
}

export default async function run(ctx, args = {}) {
  const tabId = ctx.tabId;
  if (tabId == null) throw new Error("scan_form requires a target tab");

  const snapshotId = makeSnapshotId();
  const settleMs = Math.min(Math.max(Number(args.settleMs) || 250, 50), 2_000);
  const maxWaitMs = Math.min(Math.max(Number(args.maxWaitMs) || 3_000, settleMs), 10_000);
  const allFrames = await chrome.webNavigation.getAllFrames({ tabId }) || [];
  const selection = selectFrames(allFrames, args.framePolicy || null);
  const topFrame = selection.inventory.find(frame => frame.frameId === 0);
  const tab = await chrome.tabs.get(tabId);
  const counts = { protected: 0, unsupported: 0, hidden: 0, occupied: 0 };
  const fields = [];
  const scannedFrames = [];
  let unsupportedFrames = 0;

  for (const [index, frame] of selection.selected.entries()) {
    const injected = await chrome.scripting.executeScript({
      target: { tabId, frameIds: [frame.frameId] },
      world: "ISOLATED",
      func: scanFrame,
      args: [
        snapshotId,
        "fr" + index,
        PROTECTED_FIELD_PATTERN_SOURCE,
        SELECT_PLACEHOLDER_PATTERN_SOURCE,
        settleMs,
        maxWaitMs,
      ],
    });
    const item = injected[0];
    const result = item?.result;
    if (!result || !Array.isArray(result.fields)) throw new Error("form scan returned no fields");
    const documentId = item.documentId || frame.documentId;
    for (const field of result.fields) {
      fields.push({ ...field, frameId: frame.frameId, documentId, frameOrigin: frame.origin });
    }
    for (const key of Object.keys(counts)) counts[key] += Number(result.counts?.[key] || 0);
    unsupportedFrames += Number(result.unsupportedFrames || 0);
    scannedFrames.push({ ...frame, documentId, url: result.url || frame.url });
  }

  const snapshot = {
    snapshotId,
    url: topFrame?.url || tab.url || "",
    title: tab.title || "",
    fields,
    frames: scannedFrames,
  };
  snapshots.setSnapshot(tabId, snapshot);
  return {
    snapshotId,
    url: snapshot.url,
    title: snapshot.title,
    fields,
    counts,
    unsupportedFrames,
    frameOrigins: selection.frameOrigins,
    selectedFrames: scannedFrames.map(frame => ({
      frameId: frame.frameId,
      documentId: frame.documentId,
      origin: frame.origin,
    })),
    framePolicy: selection.policy,
    tabId,
  };
}
