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

const DETAILS_HINT = "Paste your details as JSON. They are saved automatically and used when you run the agent.";

function renderDetails(message, kind = "") {
  detailsStatus.className = `note ${kind}`;
  detailsStatus.textContent = message || DETAILS_HINT;
}

// Validates and saves a details object; returns an error message or "" on success.
function saveDetails(details) {
  if (!details || typeof details !== "object" || Array.isArray(details) || !Object.keys(details).length) {
    return "Your details must be a JSON object with at least one field.";
  }
  try {
    localStorage.setItem(DETAILS_KEY, JSON.stringify(details));
  } catch {
    return "Could not save: browser storage is unavailable.";
  }
  return "";
}

// Saved automatically as you type or paste. Anything that is not a valid details object is
// not kept, so the agent never runs with stale details.
detailsText.addEventListener("input", () => {
  localStorage.removeItem(DETAILS_KEY);
  const raw = detailsText.value.trim();
  if (!raw) return renderDetails();
  if (raw.length > MAX_DETAILS_BYTES) return renderDetails("That JSON is too large (100 KB maximum).", "err");
  let details;
  try {
    details = JSON.parse(raw);
  } catch {
    return renderDetails("That is not valid JSON yet.", "err");
  }
  const error = saveDetails(details);
  renderDetails(error, error ? "err" : "");
});

{
  const saved = loadDetails();
  if (saved) detailsText.value = JSON.stringify(saved, null, 2);
}
renderDetails();

// JSON pushed from the admin page (see background.js): put it in the box and in localStorage,
// exactly as if it had been pasted. Works whether the panel was open or opened later.
function applyPushedDetails(details) {
  if (!details) return;
  chrome.storage.local.remove("pushed_details");
  const error = saveDetails(details);
  if (error) return renderDetails(error, "err");
  detailsText.value = JSON.stringify(details, null, 2);
  renderDetails("Details received from the website.", "ok");
}
chrome.storage.local.get("pushed_details", (stored) => applyPushedDetails(stored.pushed_details));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.pushed_details) applyPushedDetails(changes.pushed_details.newValue);
});

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
    td.colSpan = 4;
    td.className = "empty";
    td.textContent = message || "No samples yet.";
    return;
  }
  for (const row of rows) {
    const tr = samplesEl.insertRow();
    tr.insertCell().textContent = row.id;
    tr.insertCell().textContent = row.name || "";
    tr.insertCell().textContent = row.website_url || "";
    const view = document.createElement("button");
    view.type = "button";
    view.className = "view-json";
    view.title = "View JSON";
    view.setAttribute("aria-label", "View JSON");
    view.innerHTML = EYE_ICON;
    view.disabled = !row.sample_json;
    view.addEventListener("click", () => viewSample(row));
    const button = document.createElement("button");
    button.type = "button";
    button.className = "view-json";
    button.title = "Download JSON";
    button.setAttribute("aria-label", "Download JSON");
    button.innerHTML = DOWNLOAD_ICON;
    button.disabled = !row.sample_json;
    button.addEventListener("click", () => downloadSample(row));
    const actions = document.createElement("div");
    actions.className = "sample-actions";
    actions.append(view, button);
    tr.insertCell().append(actions);
  }
}

const DOWNLOAD_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>';
const EYE_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';

// Colors a pretty-printed JSON string: keys, strings, numbers and true/false/null.
function highlightJson(text) {
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return escaped.replace(
    /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g,
    (match, str, colon, literal) => {
      if (str) return colon ? `<span class="tok-key">${str}</span>${colon}` : `<span class="tok-str">${str}</span>`;
      return `<span class="${literal ? "tok-lit" : "tok-num"}">${match}</span>`;
    },
  );
}

const jsonModal = document.getElementById("jsonModal");
const closeJsonModal = () => jsonModal.classList.remove("open");
document.getElementById("jsonModalClose").addEventListener("click", closeJsonModal);
jsonModal.addEventListener("click", (event) => {
  if (event.target === jsonModal) closeJsonModal();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeJsonModal();
});

function viewSample(row) {
  document.getElementById("jsonModalTitle").textContent = row.name || row.website_url || `Sample ${row.id}`;
  document.getElementById("jsonModalBody").innerHTML = highlightJson(JSON.stringify(row.sample_json, null, 2));
  jsonModal.classList.add("open");
  document.getElementById("jsonModalClose").focus();
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

// Run agent to fill form: runs the same flow as "Run task" with a hardcoded instruction.
// The saved "My details" JSON is sent along with it, as with every task.
const FILL_FORM_TASK =
  "Fill in the form on the current page using the values in my saved details, then submit it. " +
  "Match each field to the closest saved detail by its label. Leave any field blank when no saved detail fits, " +
  "never invent values, and confirm the submission succeeded before finishing.";

document.getElementById("fillAgent").addEventListener("click", () => {
  if (send.disabled) return;
  if (!loadDetails()) {
    out.className = "err";
    out.textContent = "Add your details (My details) first, so the agent has values to fill in.";
    return;
  }
  // The Run task handler reads the textarea synchronously, so swap the text in for that click.
  const typed = instruction.value;
  instruction.value = FILL_FORM_TASK;
  send.click();
  instruction.value = typed;
});
