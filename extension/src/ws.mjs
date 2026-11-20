// ws.mjs — extension-side WebSocket client for the daemon ↔ extension link.
//
// Runs inside the MV3 module service worker and uses the browser-global
// WebSocket. It speaks the JSON-text-frame protocol from BUILD_SPEC §1:
//   - on open  -> sends {type:"hello", payload:{extensionVersion, extensionId}}
//   - daemon   -> {type:"hello_ack"} (noop), {type:"ping"} (reply with pong),
//                 {type:"tool_call", requestId, payload:{name,args}}
//   - we reply -> {type:"tool_result", responseToRequestId, payload:{data}|{error}}
//
// The connection URL is discovered from storage.local "local_url", which the
// fleet writes as JSON.stringify(wsUrl) — so we JSON.parse it before use.
// All transport errors are tolerated: on close/error we schedule a reconnect.

const RECONNECT_DELAY_MS = 5000;
const DEFAULT_PORTAL_URL = "ws://127.0.0.1:8110/api/chrome_plugin/ws";

export class WSClient {
  // onToolCall: async (payload{name,args}) => ({data}|{error})
  constructor({ onToolCall } = {}) {
    this.onToolCall = onToolCall;
    this.socket = null;
    this.url = null;
    this._reconnectTimer = null;
    this.lastError = null;
    this.acknowledged = false;
    this.manualDisconnect = false;
  }

  async connect(url) {
    this.manualDisconnect = false;
    this.url = url;
    this.lastError = null;
    this.acknowledged = false;
    // Replace any existing socket.
    if (this.socket) {
      try {
        this.socket.onopen = null;
        this.socket.onmessage = null;
        this.socket.onclose = null;
        this.socket.onerror = null;
        this.socket.close();
      } catch {
        // ignore
      }
      this.socket = null;
    }

    const stored = await chrome.storage.local.get("plugin_token");
    const token = typeof stored.plugin_token === "string" ? stored.plugin_token.trim() : "";
    const socket = new WebSocket(url, token ? ["chrome-plugin", token] : undefined);
    this.socket = socket;
    return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (this.socket === socket) socket.close();
      reject(new Error("Chrome plugin service did not confirm the connection"));
    }, 10000);
    socket.onopen = () => {
      const manifest = chrome.runtime.getManifest();
      socket.send(JSON.stringify({
        type: "hello",
        payload: {
          extensionVersion: manifest.version,
          extensionId: chrome.runtime.id,
        },
      }));
    };

    socket.onmessage = (event) => {
      try {
        if (JSON.parse(event.data)?.type === "hello_ack") {
          clearTimeout(timeout);
          this.acknowledged = true;
          this.lastError = null;
          resolve();
        }
      } catch {
        // The normal message handler ignores malformed frames.
      }
      this._handleMessage(event.data);
    };

    socket.onclose = (event) => {
      clearTimeout(timeout);
      if (this.socket === socket) this.socket = null;
      this.acknowledged = false;
      this.lastError = event.code === 4401
        ? "Pairing token rejected by the Chrome plugin service"
        : this.lastError || "WebSocket closed. Check that the Chrome plugin service is running and can reach the main API";
      reject(new Error(this.lastError));
      this._scheduleReconnect();
    };

    socket.onerror = () => {
      this.lastError = "Cannot reach the Chrome plugin service at the entered URL";
    };
    });
  }

  async _handleMessage(raw) {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (!msg || typeof msg !== "object") return;

    switch (msg.type) {
      case "ping":
        this.send({ type: "pong" });
        break;
      case "hello_ack":
        // nothing to do
        break;
      case "tool_call": {
        let payload;
        try {
          payload = await this.onToolCall(msg.payload);
        } catch (e) {
          payload = { error: e && e.message ? e.message : String(e) };
        }
        this.send({
          type: "tool_result",
          responseToRequestId: msg.requestId,
          payload,
        });
        break;
      }
      default:
        // unknown frame type — ignore
        break;
    }
  }

  send(obj) {
    if (this.isConnected()) {
      try {
        this.socket.send(JSON.stringify(obj));
      } catch {
        // ignore send failures; reconnect logic will recover
      }
    }
  }

  isConnected() {
    return this.acknowledged && !!this.socket && this.socket.readyState === WebSocket.OPEN;
  }

  disconnect() {
    this.manualDisconnect = true;
    this.acknowledged = false;
    this.lastError = null;
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    if (this.socket) {
      try {
        this.socket.onclose = null;
        this.socket.onerror = null;
        this.socket.close();
      } catch {
        // ignore
      }
      this.socket = null;
    }
  }

  async reconnectIfNeeded() {
    if (this.manualDisconnect) return;
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) return;
    const url = await this._readLocalUrl();
    if (this.manualDisconnect || (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING))) return;
    if (url) await this.connect(url).catch(() => {});
  }

  async _readLocalUrl() {
    try {
      const result = await chrome.storage.local.get("local_url");
      const raw = result && result.local_url;
      if (!raw) return DEFAULT_PORTAL_URL;
      // Stored as JSON.stringify(wsUrl) by the fleet — parse it.
      try {
        return JSON.parse(raw);
      } catch {
        // tolerate a bare string that wasn't JSON-encoded
        return typeof raw === "string" ? raw : null;
      }
    } catch {
      return DEFAULT_PORTAL_URL;
    }
  }

  _scheduleReconnect() {
    if (this._reconnectTimer) return;
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      this.reconnectIfNeeded();
    }, RECONNECT_DELAY_MS);
  }
}
