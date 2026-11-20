import { send } from '../dbg.mjs';
import { PROTECTED_FIELD_PATTERN_SOURCE } from '../form-fill-core.mjs';
import { getSnapshot } from '../form-snapshots.mjs';

// Narrow DOM contract: ARIA combobox + owned listbox + form-backed committed value.
// Unsupported structures stop here instead of treating search text as a selection.
async function dropdownPage(args, protectedSource) {
  const comboState = element => {
    let ancestor = element.parentElement;
    for (let depth = 0; ancestor && depth < 5; depth++, ancestor = ancestor.parentElement) {
      if (ancestor.matches('form, fieldset') || ancestor.querySelectorAll('[role="combobox"]').length > 1) break;
      const inputs = [...ancestor.querySelectorAll('input[type="hidden"][name]')];
      if (inputs.length === 1) return { supported: true, value: inputs[0].value, name: inputs[0].name };
      if (inputs.length > 1) break;
    }
    return { supported: false, value: '', name: '' };
  };
  const text = value => String(value || '').replace(/\s+/g, ' ').trim();
  const marker = args.snapshotId + ':' + args.field.fieldId;
  const el = [...document.querySelectorAll('[data-twenty-form-fill-ref]')]
    .find(node => node.getAttribute('data-twenty-form-fill-ref') === marker);
  const fail = reason => ({ status: 'failed', filled: 0, reason });
  if (location.href !== args.url || !el?.isConnected) return fail('stale dropdown');
  const label = text([
    el.getAttribute('aria-label'),
    (el.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean)
      .map(id => el.ownerDocument.getElementById(id)?.textContent).filter(Boolean).join(' '),
    ...Array.from(el.labels || [], label => label.textContent),
    el.getAttribute('placeholder'), el.getAttribute('name'), el.id,
  ].filter(Boolean).join(' ')).slice(0, 240);
  if (el.getAttribute('role') !== 'combobox' || label !== args.field.label ||
      el.id !== args.field.id || new RegExp(protectedSource, 'i').test([
        label, el.type, el.name, el.id, el.autocomplete, el.placeholder,
      ].join(' '))) return fail('dropdown identity changed or protected');
  if (el.disabled || el.getAttribute('aria-disabled') === 'true' ||
      !el.getClientRects().length || el.closest('[hidden], [inert], [aria-hidden=true]')) return fail('dropdown unavailable');
  const committed = comboState(el);
  if (!committed.supported) return fail('unsupported committed-value structure');
  if (args.phase !== 'verify' && committed.value !== args.field.beforeValue) return fail('dropdown value changed');
  const ownedList = () => (el.getAttribute('aria-controls') || el.getAttribute('aria-owns') || '')
    .split(/\s+/).map(id => document.getElementById(id))
    .find(node => node?.getAttribute('role') === 'listbox');
  if (args.phase === 'prepare') {
    el.scrollIntoView({ block: 'center' });
    el.focus();
    if (el.tagName === 'INPUT' && !el.readOnly) el.select();
    return { status: 'ready', editable: el.tagName === 'INPUT' && !el.readOnly };
  }
  if (args.phase === 'options') {
    const list = ownedList();
    const options = list ? [...list.querySelectorAll('[role=option]')]
      .filter(option => option.getClientRects().length && option.getAttribute('aria-disabled') !== 'true') : [];
    return { status: 'options', options: options.slice(0, 100).map((option, index) => {
      const optionId = args.token + ':' + index;
      option.setAttribute('data-twenty-option', optionId);
      return { optionId, label: text(option.textContent) };
    }) };
  }
  if (args.phase === 'commit') {
    const list = ownedList();
    const option = list && [...list.querySelectorAll('[data-twenty-option]')]
      .find(node => node.getAttribute('data-twenty-option') === args.option.optionId);
    if (!option || text(option.textContent) !== args.option.label ||
        option.getAttribute('aria-disabled') === 'true' || !option.getClientRects().length) return fail('option changed');
    // Observe the selection signal at click time, then require it to survive settling.
    let selected = false;
    const observer = new MutationObserver(() => {
      if (option.getAttribute('aria-selected') === 'true') selected = true;
    });
    observer.observe(option, { attributes: true, attributeFilter: ['aria-selected'] });
    option.click();
    await new Promise(resolve => setTimeout(resolve, 50));
    observer.disconnect();
    return { status: 'clicked', value: comboState(el).value, selected };
  }
  if (args.phase === 'verify') {
    const value = comboState(el).value;
    // React Select renders the selected label in the same compact control container.
    let parent = el.parentElement;
    let labelPresent = false;
    for (let depth = 0; parent && depth < 5; depth++, parent = parent.parentElement) {
      if (parent.matches('form, fieldset') || parent.querySelectorAll('[role=combobox]').length > 1) break;
      if (text(parent.textContent).includes(args.option.label)) labelPresent = true;
    }
    const ok = value && value === args.expectedValue && (labelPresent || args.selected) &&
      el.getAttribute('aria-expanded') !== 'true' && el.getAttribute('aria-invalid') !== 'true';
    return ok ? { status: 'filled', filled: 1, value, label: args.option.label } : fail('selection was not retained or could not be verified');
  }
  if (args.phase === 'cancel') {
    if (el.tagName === 'INPUT' && !el.readOnly && !committed.value) {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '');
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
    }
    return { status: 'cancelled', filled: 0 };
  }
  return fail('unknown dropdown phase');
}

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function key(tabId, key, code, virtualKey) {
  await send(tabId, 'Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: virtualKey });
  await send(tabId, 'Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: virtualKey });
}

export default async function run(ctx, args) {
  const snapshot = getSnapshot(ctx.tabId);
  const field = snapshot?.fields?.find(field => field.fieldId === args.fieldId);
  if (!snapshot || snapshot.snapshotId !== args.snapshotId || field?.inputType !== 'combobox' || field.occupied) {
    return { status: 'failed', filled: 0, reason: 'stale or occupied dropdown' };
  }
  const frame = snapshot.frames?.find(item => item.frameId === field.frameId);
  const currentFrames = await chrome.webNavigation.getAllFrames({ tabId: ctx.tabId }) || [];
  const current = currentFrames.find(item => item.frameId === field.frameId);
  if (!frame || !current || (field.documentId && current.documentId && field.documentId !== current.documentId)) {
    return { status: 'failed', filled: 0, reason: 'dropdown frame document changed' };
  }
  const call = async extra => {
    const input = { ...args, url: frame.url, field, ...extra };
    const injected = await chrome.scripting.executeScript({
      target: { tabId: ctx.tabId, frameIds: [field.frameId] },
      world: 'ISOLATED',
      func: dropdownPage,
      args: [input, PROTECTED_FIELD_PATTERN_SOURCE],
    });
    const response = injected[0]?.result;
    if (!response) throw new Error('dropdown evaluation failed');
    return response;
  };
  if (args.phase === 'open') {
    const ready = await call({ phase: 'prepare' });
    if (ready.status !== 'ready') return ready;
    if (ready.editable) await send(ctx.tabId, 'Input.insertText', { text: String(args.value) });
    else await key(ctx.tabId, 'ArrowDown', 'ArrowDown', 40);
    const token = crypto.randomUUID();
    let previous = '', stableSince = Date.now();
    const started = Date.now();
    while (Date.now() - started < 5000) {
      const response = await call({ phase: 'options', token });
      if (response.status !== 'options') return response;
      const signature = JSON.stringify(response.options);
      if (signature !== previous) { previous = signature; stableSince = Date.now(); }
      if (response.options.length && Date.now() - stableSince >= 400 && Date.now() - started >= 800) {
        snapshot.dropdown = { fieldId: field.fieldId, options: response.options };
        return response;
      }
      await pause(100);
    }
    await call({ phase: 'cancel' });
    await key(ctx.tabId, 'Escape', 'Escape', 27);
    return { status: 'failed', filled: 0, options: [], reason: 'no selectable options before timeout' };
  }
  if (args.phase === 'cancel') {
    const response = await call({ phase: 'cancel' });
    await key(ctx.tabId, 'Escape', 'Escape', 27);
    delete snapshot.dropdown;
    return response;
  }
  const option = snapshot.dropdown?.fieldId === field.fieldId &&
    snapshot.dropdown.options.find(option => option.optionId === args.optionId);
  if (!option) return { status: 'failed', filled: 0, reason: 'option was not observed' };
  delete snapshot.dropdown;
  const clicked = await call({ phase: 'commit', option });
  if (clicked.status !== 'clicked') return clicked;
  await pause(1200);
  return call({ phase: 'verify', option, expectedValue: clicked.value, selected: clicked.selected });
}
