# Third-party notices

The Jev browser decision loop in this service is adapted from
[`browser-use/jev-ultrafast`](https://github.com/browser-use/jev-ultrafast),
Copyright (c) 2026 Browser Use, licensed under the MIT License.

The adapted implementation keeps the original safety properties—bounded
execution, an indexed observed action space, stale-page checks, and no
model-generated selectors—but uses Twenty's existing authenticated Chrome
extension WebSocket bridge instead of Browser Harness/CDP.

The upstream MIT license text is reproduced in `LICENSE-JEV-ULTRAFAST`.

