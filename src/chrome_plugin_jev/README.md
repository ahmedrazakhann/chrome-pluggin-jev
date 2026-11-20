# Python service package

- `auth.py` preserves pairing-token and signed-user authentication.
- `bridge.py` preserves the extension WebSocket transport.
- `jobs.py` handles deterministic commands and natural-language Jev jobs.
- `jev_model.py` implements the bounded TypeSafe/Jev decision contract.
- `jev_browser.py` adapts that contract to the existing extension bridge.
- `jev_agent.py` owns the observe-decide-act loop and safety limits.
- `jev_fallback.py` replaces the former OpenCode form fallback.
- `form_fill*.py` retains deterministic form filling and TypeSafe matching.

The public route prefix remains `/api/chrome_plugin` for extension and portal
compatibility.
