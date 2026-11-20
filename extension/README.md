# Agent WebBridge extension

This directory contains the unpacked Chrome extension from
[`jeet-dhandha/agent-webbridge`](https://github.com/jeet-dhandha/agent-webbridge),
pinned to upstream commit `d826db595a426b1fede945954a2e7b6afaaff029` (release
v1.1.2).

The extension uses Agent WebBridge's browser tools and connects directly to
the Twenty Portal Python WebSocket bridge. This avoids platform-specific AWB
daemon setup and works on macOS and Windows.

1. Load this directory from `chrome://extensions`. The bundled version adds the
   Jev task side panel to the upstream extension.
2. Start the standalone Chrome-plugin service on the configured
   `CHROME_PLUGIN_JEV_PORT` (default `8110`).
3. Open the extension popup and choose **Open agent panel**.

The panel sends the task to the Chrome-plugin service. The in-process Python
Jev loop sends validated browser commands back through the same API. No
second agent server is started.
