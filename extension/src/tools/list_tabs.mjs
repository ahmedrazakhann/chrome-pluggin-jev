// list_tabs.mjs — enumerate open tabs with their session group titles.
// Queries every tab and decorates each with its tab-group title (best-effort).
// Returns { success:true, tabs:[{tabId,url,title,active,groupTitle}] } per §4.

import * as groups from "../groups.mjs";

export default async function run(ctx, args = {}) {
  const { chrome } = ctx;

  // Optional filters: when many windows are open, each has an "active" tab.
  // Prefer lastFocusedWindow (+ active) so Jev targets the tab the user sees.
  const query = {};
  if (args.lastFocusedWindow) query.lastFocusedWindow = true;
  if (args.active) query.active = true;
  const tabs = await chrome.tabs.query(query);

  const out = [];
  for (const tab of tabs) {
    let groupTitle = "";
    try {
      groupTitle = await groups.groupTitleForTab(tab.id);
    } catch {
      groupTitle = "";
    }
    out.push({
      tabId: tab.id,
      url: tab.url || "",
      title: tab.title || "",
      active: !!tab.active,
      windowId: tab.windowId,
      groupTitle: groupTitle || "",
    });
  }

  return { success: true, tabs: out };
}
