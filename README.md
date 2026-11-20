# Chrome plugin Jev service

This is the side-by-side successor candidate for `services/chrome_plugin`.
It preserves the existing extension, sidebar, authentication, release, direct
command, deterministic form-fill, and WebSocket bridge contracts. Natural
language browser jobs run through a bounded Jev Ultrafast-style Python loop;
there is no OpenCode, Bun, Node, Playwright, Browser Harness, or second HTTP
server at runtime.

The service defaults to `127.0.0.1:8110` so it can be tested beside the current
service. After cutover it may be configured back to port `8100`.

## Runtime flow

```text
sidebar/API job
  -> FastAPI job runner
  -> TypeSafe/Jev chooses one observed operation and target
  -> optional OpenAI-compatible helper supplies TYPE_TEXT content
  -> authenticated WebSocket bridge
  -> Chrome extension executes the observed action
  -> repeat until DONE, BLOCKED, no-progress, or the step limit
```

The extension exposes two internal commands for this loop:

- `jev_observe` returns visible text plus a bounded indexed action space.
- `jev_act` validates the page and element guards before executing one action.

The model never supplies selectors, JavaScript, coordinates, or arbitrary
tool names.

Research instructions are also supported. An explicit line such as
`Google search Banff National Park` is converted into a bounded Google search
URL. Once the requested fact is visibly supported on the preferred source,
Jev can select `ANSWER`; the text helper extracts the supported answer and the
job result includes the current source URL.

## Configure

Copy `.env.example` to `.env`, set the pairing token, and configure one
decision provider. For direct TypeSafe:

```dotenv
CHROME_PLUGIN_TOKEN=your-local-pairing-token
TYPESAFE_API_KEY=your-typesafe-key
TEXT_MODEL_API_KEY=your-openrouter-or-compatible-key
```

For OpenRouter decisions instead:

```dotenv
CHROME_PLUGIN_TOKEN=your-local-pairing-token
TYPESAFE_API_URL=https://openrouter.ai/api/alpha/decisions
OPENROUTER_API_KEY=your-openrouter-key
TYPESAFE_MODEL=~typesafe/jev-latest
```

`OPENROUTER_API_KEY` is also accepted as the text-helper credential when
`TEXT_MODEL_API_KEY` is unset.

The decision endpoint and key must belong to the same provider:

- `https://api.typesafe.ai/v1/systemone` uses `TYPESAFE_API_KEY` and typically
  `TYPESAFE_MODEL=jev-latest`.
- `https://openrouter.ai/api/alpha/decisions` uses `OPENROUTER_API_KEY` and
  `TYPESAFE_MODEL=~typesafe/jev-latest` (or a pinned Jev model).

The service detects the provider from `TYPESAFE_API_URL` and selects the
matching credential automatically.

## Run

From the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\services\chrome_plugin_jev\run.ps1
```

Then load the unpacked extension from `services/chrome_plugin_jev/extension`
and connect it to `http://127.0.0.1:8110`.

## Test

```powershell
uv run --project services/chrome_plugin_jev pytest services/chrome_plugin_jev/tests -q
node --check services/chrome_plugin_jev/extension/background.js
node --test services/chrome_plugin_jev/tests/form-fill-core.test.mjs
```

Live model and browser calls are intentionally excluded from automated tests.
See `THIRD_PARTY_NOTICES.md` for Jev Ultrafast attribution.
# chrome-pluggin-jev
