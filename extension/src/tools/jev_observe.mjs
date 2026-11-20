import { send } from "../dbg.mjs";
import { JEV_SNAPSHOT } from "../jev_snapshot.mjs";

export default async function run(ctx) {
  if (ctx.tabId == null) throw new Error("jev_observe requires a target tab");
  const { result, exceptionDetails } = await send(ctx.tabId, "Runtime.evaluate", {
    expression: JEV_SNAPSHOT,
    returnByValue: true,
    awaitPromise: true,
  });
  if (exceptionDetails) {
    throw new Error(exceptionDetails.exception?.description || exceptionDetails.text || "Jev observation failed");
  }
  if (!result?.value) throw new Error("Jev observation found no document body");
  return result.value;
}

