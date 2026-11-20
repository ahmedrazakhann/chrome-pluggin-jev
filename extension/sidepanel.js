const portalUrl = document.getElementById("portalUrl");
const pluginToken = document.getElementById("pluginToken");
const profile = document.getElementById("profile");
const instruction = document.getElementById("instruction");
const send = document.getElementById("send");
const out = document.getElementById("out");
const connect = document.getElementById("connect");
const connectionDot = document.getElementById("connectionDot");
const connectionStatus = document.getElementById("connectionStatus");

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
    const response = await fetch(`${baseUrl}/api/chrome_plugin/jobs`, {
      method: "POST",
      headers: { "content-type": "application/json", "X-Chrome-Plugin-Token": token },
      body: JSON.stringify({
        ...taskBody,
        profile: profile.value.trim() || taskBody.profile || undefined,
        session: taskBody.session || `sidepanel-${Date.now()}`,
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
