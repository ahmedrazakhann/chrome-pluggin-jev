const snapshotsByTab = new Map();

export function setSnapshot(tabId, snapshot) {
  snapshotsByTab.set(tabId, snapshot);
}

export function getSnapshot(tabId) {
  return snapshotsByTab.get(tabId) || null;
}

export function clearSnapshot(tabId) {
  snapshotsByTab.delete(tabId);
}
