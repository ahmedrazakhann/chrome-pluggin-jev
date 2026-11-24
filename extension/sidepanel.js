const portalUrl = document.getElementById("portalUrl");
const pluginToken = document.getElementById("pluginToken");
const profile = document.getElementById("profile");
const instruction = document.getElementById("instruction");
const send = document.getElementById("send");
const out = document.getElementById("out");
const connect = document.getElementById("connect");
const connectionDot = document.getElementById("connectionDot");
const connectionStatus = document.getElementById("connectionStatus");
const detailsText = document.getElementById("detailsText");
const detailsStatus = document.getElementById("detailsStatus");
const removeDetails = document.getElementById("removeDetails");

// My details: a JSON object the user pastes, kept only in this extension's
// localStorage and sent with every task.
const DETAILS_KEY = "twenty_saved_details";
const MAX_DETAILS_BYTES = 100_000;

function loadDetails() {
  try {
    return JSON.parse(localStorage.getItem(DETAILS_KEY));
  } catch {
    return null;
  }
}

function renderDetails(message, kind = "") {
  const details = loadDetails();
  removeDetails.hidden = !details;
  detailsStatus.className = `note ${kind}`;
  if (message) detailsStatus.textContent = message;
  else if (details) {
    const keys = Object.keys(details);
    detailsStatus.textContent = `${keys.length} field(s) loaded and sent with every task: ${keys.join(", ")}`;
  } else detailsStatus.textContent = "No JSON saved.";
}

document.getElementById("saveDetails").addEventListener("click", () => {
  const raw = detailsText.value.trim();
  if (!raw) return renderDetails("Paste some JSON first.", "err");
  if (raw.length > MAX_DETAILS_BYTES) return renderDetails("That JSON is too large (100 KB maximum).", "err");
  let details;
  try {
    details = JSON.parse(raw);
  } catch {
    return renderDetails("That is not valid JSON.", "err");
  }
  if (!details || typeof details !== "object" || Array.isArray(details) || !Object.keys(details).length) {
    return renderDetails('The JSON must be an object with at least one field, like {"First name": "Ahmad"}.', "err");
  }
  try {
    localStorage.setItem(DETAILS_KEY, JSON.stringify(details));
  } catch {
    return renderDetails("Could not save: browser storage is unavailable.", "err");
  }
  detailsText.value = JSON.stringify(details, null, 2);
  renderDetails();
});

removeDetails.addEventListener("click", () => {
  localStorage.removeItem(DETAILS_KEY);
  detailsText.value = "";
  renderDetails("Removed.", "ok");
});


{
  const saved = loadDetails();
  if (saved) detailsText.value = JSON.stringify(saved, null, 2);
}
renderDetails();

// Earlier versions kept a details form in chrome.storage and localStorage.
chrome.storage.local.remove(["user_info", "use_user_info"]);
localStorage.removeItem("twenty_user_info");

chrome.storage.local.get(["portal_url", "agent_profile", "plugin_token"], (stored) => {
  if (stored.portal_url) portalUrl.value = stored.portal_url;
  if (stored.agent_profile) profile.value = stored.agent_profile;
  if (stored.plugin_token) pluginToken.value = stored.plugin_token;
});

function renderConnection(connected) {
  connectionDot.classList.toggle("on", connected);
  connectionStatus.textContent = connected ? "Connected to backend" : "Disconnected";
}

function getStatus() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "GET_STATUS" }, (result) => {
      resolve(!chrome.runtime.lastError && !!result?.connected);
    });
  });
}

async function connectBackend() {
  const baseUrl = portalUrl.value.trim().replace(/\/$/, "");
  if (!/^https?:\/\//i.test(baseUrl)) throw new Error("Portal API must start with http:// or https://");
  const token = pluginToken.value.trim();
  if (!token) throw new Error("Enter the Chrome plugin pairing token first.");
  const wsUrl = new URL(baseUrl.replace(/^http/i, "ws") + "/api/chrome_plugin/ws");
  await chrome.storage.local.set({ portal_url: baseUrl, agent_profile: profile.value.trim(), plugin_token: token });
  const result = await chrome.runtime.sendMessage({ type: "CONNECT", url: wsUrl.toString() });
  if (!result?.ok) throw new Error(result?.error || "Could not connect to backend");
  await new Promise((resolve) => setTimeout(resolve, 500));
  const connected = await getStatus();
  renderConnection(connected);
  if (!connected) throw new Error("Backend did not accept the WebSocket connection");
  return baseUrl;
}

connect.addEventListener("click", async () => {
  connect.disabled = true;
  connectionStatus.textContent = "Connecting...";
  try {
    await connectBackend();
  } catch (error) {
    renderConnection(false);
    out.className = "err";
    out.textContent = String(error);
  } finally {
    connect.disabled = false;
  }
});

getStatus().then(renderConnection);

async function readJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(text || `HTTP ${response.status}`);
  }
}

async function waitForJob(baseUrl, jobId, token) {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const response = await fetch(`${baseUrl}/api/chrome_plugin/jobs/${jobId}`, {
      headers: { "X-Chrome-Plugin-Token": token },
    });
    const job = await readJson(response);
    if (!response.ok) throw new Error(job.detail || `HTTP ${response.status}`);
    if (!['queued', 'running'].includes(job.status)) return job;
    out.textContent = `Jev is working...\n\nJob ${job.id}`;
  }
  throw new Error("Timed out waiting for Jev");
}

send.addEventListener("click", async () => {
  const task = instruction.value.trim();
  if (!task) {
    out.className = "err";
    out.textContent = "Paste data and describe the task first.";
    return;
  }

  send.disabled = true;
  out.className = "";
  out.textContent = "Submitting to Jev...";

  try {
    const baseUrl = await connectBackend();
    const token = pluginToken.value.trim();
    let taskBody = { instruction: task };
    if (task.startsWith("{")) {
      try {
        const parsed = JSON.parse(task);
        if (parsed && typeof parsed === "object" && (typeof parsed.action === "string" || Array.isArray(parsed.commands))) {
          taskBody = parsed;
        }
      } catch {
        // Ordinary instructions may contain JSON-like text.
      }
    }
    const savedDetails = loadDetails();
    const response = await fetch(`${baseUrl}/api/chrome_plugin/jobs`, {
      method: "POST",
      headers: { "content-type": "application/json", "X-Chrome-Plugin-Token": token },
      body: JSON.stringify({
        ...taskBody,
        profile: profile.value.trim() || taskBody.profile || undefined,
        session: taskBody.session || `sidepanel-${Date.now()}`,
        my_saved_details: savedDetails || undefined,
      }),
    });
    const job = await readJson(response);
    if (!response.ok) throw new Error(job.detail || `HTTP ${response.status}`);

    const finished = await waitForJob(baseUrl, job.id, token);
    out.className = finished.status === "done" ? "ok" : "err";
    out.textContent = finished.result?.text || finished.error || JSON.stringify(finished, null, 2);
  } catch (error) {
    out.className = "err";
    out.textContent = `${error}\n\nCheck that the portal server is running.`;
  } finally {
    send.disabled = false;
  }
});

// Tabs
const panes = { Main: document.getElementById("paneMain"), Settings: document.getElementById("paneSettings") };
for (const name of Object.keys(panes)) {
  document.getElementById(`tab${name}`).addEventListener("click", () => {
    for (const [n, pane] of Object.entries(panes)) {
      pane.hidden = n !== name;
      document.getElementById(`tab${n}`).classList.toggle("active", n === name);
    }
  });
}

// Settings tab: read-only list of sample JSON per website, loaded from the backend
const samplesEl = document.getElementById("samples");

function renderSamples(rows, message) {
  samplesEl.textContent = "";
  if (!rows.length) {
    const td = samplesEl.insertRow().insertCell();
    td.colSpan = 3;
    td.className = "empty";
    td.textContent = message || "No samples yet.";
    return;
  }
  for (const row of rows) {
    const tr = samplesEl.insertRow();
    tr.insertCell().textContent = row.id;
    tr.insertCell().textContent = row.website_url || "";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "download-json";
    button.textContent = "Download JSON";
    button.disabled = !row.sample_json;
    button.addEventListener("click", () => downloadSample(row));
    tr.insertCell().append(button);
  }
}

function downloadSample(row) {
  let host = "site";
  try {
    host = new URL(row.website_url).hostname.replace(/[^a-z0-9.-]/gi, "_");
  } catch {
    // Not a valid URL; keep the generic name.
  }
  const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([JSON.stringify(row.sample_json, null, 2)], { type: "application/json" }));
  link.download = `sample-${row.id}-${host}-${stamp}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function loadSamples() {
  renderSamples([], "Loading...");
  try {
    const baseUrl = portalUrl.value.trim().replace(/\/$/, "");
    const token = pluginToken.value.trim();
    if (!token) return renderSamples([], "Enter the pairing token in the Task tab first.");
    const response = await fetch(`${baseUrl}/api/chrome_plugin/settings`, { headers: { "X-Chrome-Plugin-Token": token } });
    const body = await readJson(response);
    if (!response.ok) throw new Error(body.detail || `HTTP ${response.status}`);
    renderSamples(body.settings || []);
  } catch (error) {
    renderSamples([], `Could not load samples: ${error.message}`);
  }
}

document.getElementById("tabSettings").addEventListener("click", loadSamples);
