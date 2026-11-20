// popup.js — Agent WebBridge popup controller.
// On load it sends {type:"GET_STATUS"} to the background service worker; this
// message is the SW wake trigger that the fleet relies on (do not remove).
// Renders connection state and wires the Connect / Disconnect buttons, which
// send {type:"CONNECT"} / {type:"DISCONNECT"} to the background.

const dot = document.getElementById("dot");
const statusText = document.getElementById("statusText");
const connectBtn = document.getElementById("connect");
const disconnectBtn = document.getElementById("disconnect");
const openAgentBtn = document.getElementById("openAgent");
const backendUrl = document.getElementById("backendUrl");
const pluginToken = document.getElementById("pluginToken");
const message = document.getElementById("message");

chrome.storage.local.get(["portal_url", "plugin_token"], (stored) => {
  if (stored.portal_url) backendUrl.value = stored.portal_url;
  if (stored.plugin_token) pluginToken.value = stored.plugin_token;
});

function render(r) {
  const connected = !!(r && r.connected);
  dot.classList.toggle("on", connected);
  dot.classList.toggle("off", !connected);
  statusText.textContent = connected ? "Connected" : "Disconnected";
  connectBtn.disabled = connected;
  disconnectBtn.disabled = !connected;
}

function refresh() {
  // GET_STATUS doubles as the service-worker wake trigger.
  chrome.runtime.sendMessage({ type: "GET_STATUS" }, (r) => {
    if (chrome.runtime.lastError) {
      render({ connected: false });
      return;
    }
    render(r);
    if (!r?.connected && r?.error) message.textContent = r.error;
  });
}

connectBtn.addEventListener("click", async () => {
  const baseUrl = backendUrl.value.trim().replace(/\/$/, "");
  if (!/^https?:\/\//i.test(baseUrl)) {
    message.textContent = "Backend URL must start with http:// or https://";
    return;
  }
  const token = pluginToken.value.trim();
  if (!token) {
    message.textContent = "Enter the Chrome plugin pairing token first";
    return;
  }
  connectBtn.disabled = true;
  message.textContent = "Connecting...";
  const wsUrl = new URL(baseUrl.replace(/^http/i, "ws") + "/api/chrome_plugin/ws");
  await chrome.storage.local.set({ portal_url: baseUrl, plugin_token: token });
  chrome.runtime.sendMessage({ type: "CONNECT", url: wsUrl.toString() }, (result) => {
    if (chrome.runtime.lastError || !result?.ok) {
      message.textContent = result?.error || "Could not contact the extension service worker";
      render({ connected: false });
      return;
    }
    message.textContent = "Connected";
    refresh();
  });
});

disconnectBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "DISCONNECT" }, () => {
    void chrome.runtime.lastError;
    message.textContent = "Disconnected";
    setTimeout(refresh, 300);
  });
});

openAgentBtn.addEventListener("click", async () => {
  const currentWindow = await chrome.windows.getCurrent();
  await chrome.sidePanel.open({ windowId: currentWindow.id });
  window.close();
});

refresh();
