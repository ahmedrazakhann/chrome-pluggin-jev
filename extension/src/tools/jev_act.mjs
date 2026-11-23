import { send } from "../dbg.mjs";

const TARGET = String.raw`function(payload) {
  const action=payload.action, cache=window.__twentyJev;
  // Each refusal says why, so the backend log shows what changed.
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const describe=n=>n ? n.tagName.toLowerCase()+(n.id ? '#'+n.id : '')+
    (typeof n.className==='string' && n.className ? '.'+n.className.trim().split(/\s+/).slice(0,2).join('.') : '') : 'nothing';
  if (!cache) return {stale:true,reason:'page was reloaded since it was read'};
  const key=cache.pageKey(), old=payload.pageKey||[];
  if (!same(key,old)) {
    const parts=['page reloaded','URL changed','page scrolled','page scrolled','window resized','window resized','a field value changed'];
    return {stale:true,reason:parts[key.findIndex((v,i)=>!same(v,old[i]))]||'page changed'};
  }
  const e=cache.nodes.get(action.node);
  if (!e) return {stale:true,reason:'element no longer exists'};
  const guard=cache.guard(e), oldGuard=payload.guard||[];
  if (!same(guard,oldGuard)) {
    const parts=['element replaced','role changed','label changed','value changed','checked changed','selection changed',
      'read-only changed','disabled changed','aria-disabled changed','expanded changed','checked changed','selected changed',
      'link changed','text around the element changed'];
    return {stale:true,reason:guard ? parts[guard.findIndex((v,i)=>!same(v,oldGuard[i]))]||'element changed' : 'element is hidden'};
  }
  if (!e.isConnected) return {stale:true,reason:'element was removed'};
  if (e.matches(':disabled') || e.closest('[aria-disabled="true"],[inert]')) return {stale:true,reason:'element is disabled'};
  if (!e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})) return {stale:true,reason:'element is not visible'};
  if (action.kind==='fill' && (e.readOnly || e.getAttribute('aria-readonly')==='true')) return {stale:true,reason:'field is read-only'};
  const r=e.getBoundingClientRect(), x=r.x+r.width/2, y=r.y+r.height/2;
  if (!r.width || !r.height || x<0 || y<0 || x>=innerWidth || y>=innerHeight) return {stale:true,reason:'element is off screen'};
  const hit=document.elementFromPoint(x,y);
  if (!e.contains(hit)) return {stale:true,reason:'element is covered by '+describe(hit)};
  if (action.kind==='select') {
    if (e.tagName!=='SELECT' || ![...e.options].some(o=>o.value===action.value && !o.disabled &&
        !o.closest('optgroup[disabled]'))) return {stale:true,reason:'dropdown option is no longer available'};
    e.value=action.value;
    e.dispatchEvent(new Event('input',{bubbles:true}));
    e.dispatchEvent(new Event('change',{bubbles:true}));
    return {selected:true,value:e.value};
  }
  // Native date/time inputs and sliders ignore typed text, so set the value
  // directly and fire the events a user edit would.
  if (action.kind==='fill' && e.tagName==='INPUT' &&
      ['date','time','datetime-local','month','week','range'].includes(e.type)) {
    const before=e.value, text=String(payload.text??'').trim();
    const wanted=e.type==='range' ? String(parseFloat(text)) : text;
    const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
    setter.call(e,wanted);
    const kept=e.type==='range' ? wanted!=='NaN' && Number(e.value)===Number(wanted) : e.value===wanted;
    if (!kept) {
      setter.call(e,before);
      return {rejected:true,type:e.type,min:e.min,max:e.max};
    }
    e.dispatchEvent(new Event('input',{bubbles:true}));
    e.dispatchEvent(new Event('change',{bubbles:true}));
    return {filled:true,value:e.value};
  }
  return {x,y};
}`;

export default async function run(ctx, args = {}) {
  if (ctx.tabId == null) throw new Error("jev_act requires a target tab");
  const action = args.action;
  if (!action || typeof action !== "object") throw new Error("jev_act requires an observed action");
  if (action.kind === "wait") {
    await new Promise((resolve) => setTimeout(resolve, 150));
    return { executed: action.id };
  }
  if (action.kind === "scroll") {
    await send(ctx.tabId, "Input.dispatchMouseEvent", {
      type: "mouseWheel", x: 550, y: 650, deltaX: 0, deltaY: Number(action.delta) || 0,
    });
    return { executed: action.id };
  }
  if (!["click", "fill", "select"].includes(action.kind) || !Number.isInteger(action.node)) {
    throw new Error("jev_act rejected an unsupported action");
  }
  if (action.kind === "fill") {
    const text = args.text;
    if (typeof text !== "string" || !text || text.length > 2000) throw new Error("jev_act rejected invalid text");
  }
  const payload = { action, pageKey: args.pageKey, guard: args.guard, text: args.text };
  const { result, exceptionDetails } = await send(ctx.tabId, "Runtime.evaluate", {
    expression: `(${TARGET})(${JSON.stringify(payload)})`,
    returnByValue: true,
    awaitPromise: true,
    userGesture: true,
  });
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || exceptionDetails.text);
  const target = result?.value;
  if (!target || target.stale) {
    throw new Error(`Stale page: ${target?.reason || "page changed"}; observe again before acting`);
  }
  if (action.kind === "select") return { executed: action.id, value: target.value };
  if (target.filled) return { executed: action.id, value: target.value };
  if (target.rejected) {
    const expected = target.type === "range"
      ? `a number from ${target.min || 0} to ${target.max || 100}`
      : { date: "YYYY-MM-DD", time: "HH:MM", "datetime-local": "YYYY-MM-DDTHH:MM",
          month: "YYYY-MM", week: "YYYY-Www" }[target.type];
    throw new Error(`The ${target.type} field did not accept ${JSON.stringify(args.text)}; expected ${expected}`);
  }

  for (const type of ["mousePressed", "mouseReleased"]) {
    await send(ctx.tabId, "Input.dispatchMouseEvent", {
      type, x: target.x, y: target.y, button: "left", clickCount: 1,
    });
  }
  if (action.kind === "fill") {
    const text = args.text;
    const modifier = navigator.platform?.includes("Mac") ? 4 : 2;
    await send(ctx.tabId, "Input.dispatchKeyEvent", {
      type: "keyDown", key: "a", code: "KeyA", modifiers: modifier, commands: ["selectAll"],
    });
    await send(ctx.tabId, "Input.dispatchKeyEvent", {
      type: "keyUp", key: "a", code: "KeyA", modifiers: modifier,
    });
    await send(ctx.tabId, "Input.insertText", { text });
  }
  return { executed: action.id };
}
