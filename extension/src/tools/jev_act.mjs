import { send } from "../dbg.mjs";

const TARGET = String.raw`function(payload) {
  const action=payload.action, cache=window.__twentyJev;
  if (!cache || JSON.stringify(cache.pageKey())!==JSON.stringify(payload.pageKey)) return {stale:true};
  const e=cache.nodes.get(action.node);
  if (!e || JSON.stringify(cache.guard(e))!==JSON.stringify(payload.guard)) return {stale:true};
  if (!e.isConnected || e.matches(':disabled') || e.closest('[aria-disabled="true"],[inert]') ||
      !e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})) return {stale:true};
  if (action.kind==='fill' && (e.readOnly || e.getAttribute('aria-readonly')==='true')) return {stale:true};
  const r=e.getBoundingClientRect(), x=r.x+r.width/2, y=r.y+r.height/2;
  if (!r.width || !r.height || x<0 || y<0 || x>=innerWidth || y>=innerHeight ||
      !e.contains(document.elementFromPoint(x,y))) return {stale:true};
  if (action.kind==='select') {
    if (e.tagName!=='SELECT' || ![...e.options].some(o=>o.value===action.value && !o.disabled &&
        !o.closest('optgroup[disabled]'))) return {stale:true};
    e.value=action.value;
    e.dispatchEvent(new Event('input',{bubbles:true}));
    e.dispatchEvent(new Event('change',{bubbles:true}));
    return {selected:true,value:e.value};
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
  const payload = { action, pageKey: args.pageKey, guard: args.guard };
  const { result, exceptionDetails } = await send(ctx.tabId, "Runtime.evaluate", {
    expression: `(${TARGET})(${JSON.stringify(payload)})`,
    returnByValue: true,
    awaitPromise: true,
    userGesture: true,
  });
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || exceptionDetails.text);
  const target = result?.value;
  if (!target || target.stale) throw new Error("Stale page: observe again before acting");
  if (action.kind === "select") return { executed: action.id, value: target.value };

  for (const type of ["mousePressed", "mouseReleased"]) {
    await send(ctx.tabId, "Input.dispatchMouseEvent", {
      type, x: target.x, y: target.y, button: "left", clickCount: 1,
    });
  }
  if (action.kind === "fill") {
    const text = args.text;
    if (typeof text !== "string" || !text || text.length > 2000) throw new Error("jev_act rejected invalid text");
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
