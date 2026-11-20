// Select an observed native <select> option by exact label and verify it stuck.
import { resolveSelector } from "../dom.mjs";
import { send } from "../dbg.mjs";
import { PROTECTED_FIELD_PATTERN_SOURCE } from "../form-fill-core.mjs";

const SELECT_FN = `async function(label, protectedSource) {
  const text = value => String(value || '').replace(/\\s+/g, ' ').trim();
  if (this.tagName !== 'SELECT' || this.multiple || this.disabled || !this.getClientRects().length) {
    return {status:'failed', reason:'target is not an available single-select'};
  }
  const metadata = [this.name, this.id, this.getAttribute('aria-label'),
    ...Array.from(this.labels || [], item => item.textContent)].map(text).join(' ');
  if (new RegExp(protectedSource, 'i').test(metadata)) return {status:'failed', reason:'protected field'};
  const before = text(this.selectedOptions[0]?.textContent);
  if (this.value && !/^\\[?please select\\]?$/i.test(before)) return {status:'failed', reason:'field already occupied'};
  const matches = Array.from(this.options).filter(option => !option.disabled && text(option.textContent) === label);
  if (matches.length !== 1 || /^\\[?please select\\]?$/i.test(label)) return {status:'failed', reason:'unknown or ambiguous option'};
  const value = matches[0].value;
  const view = this.ownerDocument.defaultView;
  Object.getOwnPropertyDescriptor(view.HTMLSelectElement.prototype, 'value').set.call(this, value);
  this.dispatchEvent(new view.Event('input', {bubbles:true}));
  this.dispatchEvent(new view.Event('change', {bubbles:true}));
  await new Promise(resolve => setTimeout(resolve, 1200));
  const selectedLabel = text(this.selectedOptions[0]?.textContent);
  return {status:this.isConnected && this.value === value && selectedLabel === label ? 'filled' : 'failed',
    before, label:selectedLabel, value:this.value};
}`;

export default async function run(ctx, args = {}) {
  const tabId = ctx.tabId;
  if (tabId == null) throw new Error("select_option requires a target tab");
  if (typeof args.selector !== "string" || typeof args.label !== "string") {
    throw new Error("select_option requires selector and label");
  }
  const { objectId } = await resolveSelector(tabId, args.selector);
  const { result, exceptionDetails } = await send(tabId, "Runtime.callFunctionOn", {
    objectId,
    functionDeclaration: SELECT_FN,
    arguments: [{ value: args.label.trim() }, { value: PROTECTED_FIELD_PATTERN_SOURCE }],
    returnByValue: true,
    awaitPromise: true,
    userGesture: true,
  });
  if (exceptionDetails) {
    throw new Error(exceptionDetails.exception?.description || exceptionDetails.text);
  }
  return result?.value || { status: "failed", reason: "selection returned no result" };
}
