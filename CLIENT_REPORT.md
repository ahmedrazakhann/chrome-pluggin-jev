# Chrome Plugin JEV: Progress Report

**Baseline:** `chrome_plugin_jev-first` (first delivery, snapshot dated 29 Oct to 2 Nov 2026)
**Current:** `chrome_plugin_jev` (latest `main` work, 20 Nov to 26 Nov 2026, 27 commits)

## 1. Summary

The first version could take a plain-language instruction and carry it out in Chrome. It could also fill forms from a saved record. The new version keeps all of that. It adds:

- A **My details / Settings** workflow, so users supply their own data and sample data per website.
- A **match score** that shows how well the user's data fits a given website's form.
- A more **persistent agent** that recovers from errors and handles multi-step forms, search popups, date fields and sliders.
- Detailed **logging and timing**.
- **Docker packaging and automated deployment** to AWS.
- A new **admin console** and a **demo customs-declaration site** used for testing.

## 2. What the extension can do now

### Features in both versions
- Run natural-language browser jobs through the bounded Jev loop (observe the page, choose one action, execute, repeat).
- Google-search research with a sourced answer.
- Deterministic form filling from a JSON record.
- Authenticated WebSocket bridge between the extension and the backend.

### New capabilities

| Area | New capability |
|---|---|
| **Side panel UI** | The side panel now has **Task** and **Settings** tabs. The Task tab has a **My details** section where the user pastes or uploads their JSON and edits it in place. It also has an **"Allow agent to submit"** toggle (off by default, so the agent never submits unless the user opts in) and a **Fill with agent** button. |
| **Per-website sample data** | The Settings tab lists the sample JSON stored for each website. Users can view it in a syntax-highlighted modal or download it. The data lives in a Postgres `extension_settings` table, read and written through new authenticated API endpoints: `GET /settings` and `POST /settings`. |
| **Match score** | `POST /settings/compare` scores how closely the user's JSON keys match the stored sample for the exact website URL. A strict model prompt compares field meanings, not just spelling. The side panel shows a 0 to 100% bar, green at 70 or above, amber at 40 or above, red below. |
| **Admin console** (`admin/`) | A web page ("Form Sample Registry") for managing sample forms: name, description, website and JSON, edited with a CodeMirror editor. **"Push to extension"** sends a record straight into the extension through Chrome's external messaging. The extension keeps only the JSON and the website, and rejects anything larger than 100 KB. |
| **Smarter multi-step forms** | The agent works through "Step 1 / Step 2 / Next" wizards, finishes each open sub-form with its own Save button before moving on, clicks toggles such as "Same as Exporter" only once, and only submits when asked. |
| **Search and lookup popups** | When a field needs a code but the instruction gives only a name, the agent opens that field's own Search dialog and picks the match. It labels popup fields by their dialog title, for example "Search Port [for Port of Discharge] › Name". It skips secondary paths such as "Add New" unless the user asks for them. When there is no value for a field, it skips the field and moves on instead of failing. |
| **Date, time and slider fields** | Date, time, datetime, month, week and range inputs are now filled directly in the right format. They previously could not be typed into. |
| **Scrolling** | If the model says DONE or BLOCKED while the page continues below the viewport, the agent scrolls and re-checks (up to 8 times in a row) before stopping. |
| **Resilience** | Stale-page refusals are retried. An action the browser keeps refusing is dropped, so the model tries another route. A click that has no effect is dropped too. Gateway errors from OpenRouter are retried. The browser's own refusals now say why, for example "element is covered by …" or "URL changed". The extension also scrolls an off-screen element into view before acting on it. |
| **Page reading** | Content is read from the topmost open modal only. Popups that are mid-fade-in are no longer misread as hidden. Chrome's autofill dropdown is suppressed so it cannot paste old values. Plain text boxes no longer show a misleading "Open" action. |
| **Connection handling** | The popup and side panel update live when the socket connects or disconnects. A manual disconnect now survives Chrome restarting the extension's service worker. |
| **Limits** | The maximum agent steps per job rose from 60 to **180**, for long forms. |

## 3. Back-end and operations changes

- **Structured logging** (`logs.py`, plus changes across the app):
  - Per-step timing for page reads, model calls, helper calls and browser actions.
  - A run-end breakdown of where time went.
  - Slow tool calls (3 s or more) stand out.
  - Detailed "why it stopped" messages.
  - Optional log file (`JEV_LOG_FILE`) and level (`JEV_LOG_LEVEL`).
  - The noisy job-polling access line is hidden.
- **Standalone service:** the app no longer depends on the parent monorepo (it has its own local config helper and repository root).
- **New dependency:** `psycopg` for the Postgres settings store.
- **Docker:** a `Dockerfile` (Python 3.14 + uv) and `docker-compose.yml` exposing the service on port 3333.
- **CI/CD** (`.github/workflows/deploy-backend.yml`):
  - A push to `main` builds the image.
  - The image goes to S3 and is deployed to EC2 through SSM.
  - The server never builds, and its `.env` is preserved.
  - A **log-redaction** step (with a self-test) keeps secrets out of deployment logs.

## 4. Test and demo assets

- `p1/frontend`: a Next.js **customs declaration sandbox** (4 steps, search popups, invoice line items, validation, no backend). It is a safe target for testing the agent, along with the sample JSONs (`customs-declaration.json`, `applicant-registration.json`, `my-details.sample.json`).
- `admin/data.json`: sample records, for example "Dubai Trade Detail Form".

## 5. Not changed

The core contracts are unchanged: pairing-token auth, the release/distribution flow, direct commands, the deterministic form-fill engine and the domain-skills library. No new automated tests were added to the `tests/` folder since the first version.

## 6. Points to confirm before sending

- The **extension's manifest permissions** are unchanged, but a new `externally_connectable` entry allows messages from the localhost admin page. Production may need the real admin URL.
- The similarity model is set in code to `gpt-4.1` through `OPENAI_API_KEY`.
- `p1/frontend/node_modules` is present in the working folder; it should not go to the client.
