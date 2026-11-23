"""Standalone Chrome-plugin API entrypoint backed by the in-process Jev agent."""

from __future__ import annotations

import logging
import os
import sys
import hashlib
import json
import re
import time
import zipfile
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse


SERVICE_SRC = Path(__file__).resolve().parent
REPOSITORY_ROOT = SERVICE_SRC.parents[2]
load_dotenv(REPOSITORY_ROOT / ".env")
if str(SERVICE_SRC) not in sys.path:
    sys.path.insert(0, str(SERVICE_SRC))


def configure_logging() -> None:
    """Send the chrome_plugin_jev logs to the console, and to JEV_LOG_FILE if set."""

    logger = logging.getLogger("chrome_plugin_jev")
    if logger.handlers:  # already configured (e.g. uvicorn --reload re-import)
        return
    logger.setLevel(os.getenv("JEV_LOG_LEVEL", "INFO").strip().upper() or "INFO")
    logger.propagate = False
    formatter = logging.Formatter("%(asctime)s %(levelname)-7s [%(name)s] %(message)s", "%H:%M:%S")
    handlers: list[logging.Handler] = [logging.StreamHandler()]
    log_file = os.getenv("JEV_LOG_FILE", "").strip()
    if log_file:
        path = Path(log_file).expanduser()
        path.parent.mkdir(parents=True, exist_ok=True)
        handlers.append(logging.FileHandler(path, encoding="utf-8"))
    for handler in handlers:
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    logging.getLogger("uvicorn.access").addFilter(_HideJobPolling())


class _HideJobPolling(logging.Filter):
    """Drop uvicorn's access line for the side panel's once-a-second job status check."""

    def filter(self, record: logging.LogRecord) -> bool:
        args = record.args if isinstance(record.args, tuple) else ()
        return not (len(args) >= 5 and args[1] == "GET" and str(args[2]).startswith("/api/chrome_plugin/jobs/") and args[4] == 200)


configure_logging()

from chrome_plugin_jev.router import router as bridge_router  # noqa: E402


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield


production = os.getenv("ENVIRONMENT", "development").strip().lower() == "production"
docs_enabled = not production and os.getenv("ENABLE_API_DOCS", "true").strip().lower() in {"1", "true", "yes"}
app = FastAPI(
    title="Twenty Chrome Plugin Jev Service",
    version="0.1.0",
    lifespan=lifespan,
    openapi_url="/openapi.json" if docs_enabled else None,
    docs_url="/docs" if docs_enabled else None,
    redoc_url="/redoc" if docs_enabled else None,
)
allowed_origins = [
    item.strip().rstrip("/")
    for item in os.getenv("CORS_ALLOWED_ORIGINS", "http://127.0.0.1:3000,http://localhost:3000").split(",")
    if item.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Chrome-Plugin-Token", "X-Portal-User-ID", "X-Portal-Email", "X-Portal-User-Signature"],
)


@app.middleware("http")
async def security_headers(request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    response.headers.setdefault(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'; frame-ancestors 'none';",
    )
    if request.url.scheme == "https":
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    return response


app.include_router(bridge_router, prefix="/api/chrome_plugin")


def release_directory() -> Path:
    configured = os.getenv("CHROME_PLUGIN_RELEASE_DIR", "dist/releases")
    directory = (Path(__file__).resolve().parents[1] / configured).resolve()
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def extension_source_directory() -> Path:
    return Path(__file__).resolve().parents[1] / "extension"


def _source_manifest() -> dict[str, str]:
    manifest_path = extension_source_directory() / "manifest.json"
    return json.loads(manifest_path.read_text(encoding="utf-8"))


def _source_files() -> list[Path]:
    return sorted(
        (path for path in extension_source_directory().rglob("*") if path.is_file()),
        key=lambda path: path.relative_to(extension_source_directory()).as_posix(),
    )


def _source_metadata() -> dict[str, tuple[int, tuple[int, int, int, int, int, int]]]:
    source = extension_source_directory()
    return {
        path.relative_to(source).as_posix(): (
            path.stat().st_size,
            time.localtime(path.stat().st_mtime)[:6],
        )
        for path in _source_files()
    }


def _source_content_hash() -> str:
    digest = hashlib.sha256()
    source = extension_source_directory()
    for path in _source_files():
        name = path.relative_to(source).as_posix().encode("utf-8")
        digest.update(len(name).to_bytes(4, "big"))
        digest.update(name)
        digest.update(path.read_bytes())
    return digest.hexdigest()


def _package_content_hash(package: Path) -> str:
    digest = hashlib.sha256()
    with zipfile.ZipFile(package) as bundle:
        for name in sorted(item.filename for item in bundle.infolist() if not item.is_dir()):
            encoded_name = name.replace("\\", "/").encode("utf-8")
            digest.update(len(encoded_name).to_bytes(4, "big"))
            digest.update(encoded_name)
            digest.update(bundle.read(name))
    return digest.hexdigest()


def _package_matches_source(package: Path) -> bool:
    """Use cheap archive metadata first, then hash contents only on mismatch."""
    with zipfile.ZipFile(package) as bundle:
        package_metadata = {
            item.filename.replace("\\", "/"): (item.file_size, item.date_time)
            for item in bundle.infolist()
            if not item.is_dir()
        }
    source_metadata = _source_metadata()
    if package_metadata == source_metadata:
        return True
    return _source_content_hash() == _package_content_hash(package)


def _increment_patch_version() -> str:
    manifest_path = extension_source_directory() / "manifest.json"
    manifest_text = manifest_path.read_text(encoding="utf-8")
    manifest = json.loads(manifest_text)
    current_version = str(manifest.get("version", "dev"))
    parts = current_version.split(".")
    if len(parts) < 3 or not all(part.isdigit() for part in parts):
        raise RuntimeError(f"Cannot auto-increment invalid Chrome extension version: {current_version}")

    next_parts = [*parts]
    next_parts[-1] = str(int(next_parts[-1]) + 1)
    next_version = ".".join(next_parts)
    updated_text, replacements = re.subn(
        rf'("version"\s*:\s*"){re.escape(current_version)}("),',
        rf'\g<1>{next_version}\g<2>,',
        manifest_text,
        count=1,
    )
    if replacements != 1:
        raise RuntimeError("Could not update the version in the Chrome extension manifest")
    manifest_path.write_text(updated_text, encoding="utf-8")
    return next_version


def _build_current_package() -> Path:
    """Package the canonical extension source when a download is requested."""
    source = extension_source_directory()
    version = str(_source_manifest().get("version", "dev"))
    release_dir = release_directory()
    archive = release_dir / f"twenty-chrome-plugin-{version}.zip"
    temporary_archive = release_dir / f".twenty-chrome-plugin-{version}.zip.tmp"

    with zipfile.ZipFile(temporary_archive, "w", compression=zipfile.ZIP_DEFLATED) as bundle:
        for path in sorted(source.rglob("*")):
            if path.is_file():
                bundle.write(path, path.relative_to(source).as_posix())
    os.replace(temporary_archive, archive)
    return archive


def _ensure_current_package() -> Path:
    return _refresh_current_package()[0]


@app.get("/chrome-plugin/health")
def health() -> dict[str, str]:
    return {"service": "chrome_plugin_jev", "status": "ok"}


def _latest_package() -> Path | None:
    directory = release_directory()
    packages = sorted(directory.glob("*.zip"), key=lambda path: path.stat().st_mtime, reverse=True)
    return packages[0] if packages else None


def _refresh_current_package() -> tuple[Path, bool]:
    package = _latest_package()
    if package is None or not _package_matches_source(package):
        _increment_patch_version()
        return _build_current_package(), True
    return package, False


def _release_metadata(package: Path | None) -> dict[str, str | int | None]:
    if package is None:
        return {
            "service": "chrome_plugin_jev",
            "version": None,
            "filename": None,
            "download_url": None,
            "sha256": None,
            "size_bytes": None,
        }
    digest = hashlib.sha256(package.read_bytes()).hexdigest()
    return {
        "service": "chrome_plugin_jev",
        "version": package.stem.removeprefix("twenty-chrome-plugin-") or package.stem,
        "filename": package.name,
        "download_url": "/chrome-plugin/download/latest",
        "sha256": digest,
        "size_bytes": package.stat().st_size,
    }


@app.get("/chrome-plugin", response_class=HTMLResponse)
def chrome_plugin_page() -> str:
    """Human-friendly release page for downloading and verifying the extension."""
    from chrome_plugin_jev.landing_page import CHROME_PLUGIN_PAGE as landing_page
    return landing_page


@app.get("/chrome-plugin/releases/latest")
def latest_release() -> dict[str, str | int | bool | None]:
    package, refreshed = _refresh_current_package()
    metadata = _release_metadata(package)
    metadata["refreshed"] = refreshed
    return metadata


@app.get("/chrome-plugin/releases/check")
def check_latest_release() -> dict[str, str | int | bool | None]:
    package, refreshed = _refresh_current_package()
    metadata = _release_metadata(package)
    metadata["refreshed"] = refreshed
    metadata["source_version"] = _source_manifest().get("version")
    return metadata


@app.get("/chrome-plugin/download/latest")
def download_latest() -> FileResponse:
    package = _ensure_current_package()
    return FileResponse(package, media_type="application/zip", filename=package.name)


CHROME_PLUGIN_PAGE = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Twenty Chrome Plugin</title>
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, sans-serif; color: #17352c; background: #f5f8f6; }
    * { box-sizing: border-box; } body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 32px 18px; }
    main { width: min(720px, 100%); } .eyebrow { color: #6a8c7d; font-size: 11px; font-weight: 800; letter-spacing: .16em; }
    h1 { margin: 12px 0 10px; font-size: clamp(32px, 7vw, 58px); letter-spacing: -.06em; line-height: .98; }
    .lede { color: #698078; font-size: 16px; line-height: 1.55; margin: 0 0 26px; }
    .card { background: #fff; border: 1px solid #dce9e1; border-radius: 16px; box-shadow: 0 16px 42px #1643330d; padding: 24px; }
    .release { align-items: center; display: flex; gap: 14px; justify-content: space-between; margin-bottom: 22px; }
    .release h2 { font-size: 19px; margin: 0 0 4px; } .muted { color: #83968e; font-size: 13px; }
    .badge { background: #e7f4eb; border-radius: 999px; color: #347755; font-size: 11px; font-weight: 800; padding: 7px 10px; white-space: nowrap; }
    .download { background: #1f5144; border-radius: 9px; color: #fff; display: inline-block; font-weight: 750; padding: 12px 16px; text-decoration: none; }
    .download:hover { background: #163c33; } .download.disabled { background: #aabbb3; pointer-events: none; }
    dl { border-top: 1px solid #edf2ef; display: grid; gap: 13px; margin: 20px 0 0; padding-top: 18px; }
    .row { align-items: start; display: grid; gap: 12px; grid-template-columns: 110px 1fr; } dt { color: #869890; font-size: 12px; } dd { margin: 0; color: #40574d; font-size: 12px; overflow-wrap: anywhere; }
    code { background: #f3f7f4; border-radius: 5px; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; padding: 3px 5px; }
    .instructions { color: #60766c; font-size: 13px; line-height: 1.6; margin: 24px 0 0; } .instructions strong { color: #294d3e; }
    .empty { color: #8b4e38; background: #fff6ef; border: 1px solid #f1d6c5; border-radius: 9px; padding: 13px; }
    @media (max-width: 520px) { .release { align-items: flex-start; flex-direction: column; } .row { grid-template-columns: 88px 1fr; } }
  </style>
</head>
<body>
  <main>
    <div class="eyebrow">TWENTY · BROWSER TOOLS</div>
    <h1>Chrome plugin</h1>
    <p class="lede">Download the local automation bridge for Chrome. Verify the file before installing it as an unpacked extension.</p>
    <section class="card" aria-live="polite">
      <div id="release"><p class="muted">Loading release metadata…</p></div>
    </section>
  </main>
  <script>
    const release = document.getElementById('release');
    const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
    fetch('/chrome-plugin/releases/latest').then((response) => response.json()).then((data) => {
      if (!data.filename) { release.innerHTML = '<div class="empty">No packaged release is available yet. Run the Chrome plugin packaging command, then refresh this page.</div>'; return; }
      const size = `${(data.size_bytes / 1024 / 1024).toFixed(2)} MB`;
      release.innerHTML = `<div class="release"><div><h2>Agent WebBridge ${esc(data.version)}</h2><div class="muted">${esc(data.filename)} · ${size}</div></div><span class="badge">READY</span></div><a class="download" href="${esc(data.download_url)}">Download ZIP</a><dl><div class="row"><dt>SHA-256</dt><dd><code>${esc(data.sha256)}</code></dd></div><div class="row"><dt>Verify</dt><dd>PowerShell: <code>Get-FileHash .\\${esc(data.filename)} -Algorithm SHA256</code></dd></div></dl><p class="instructions"><strong>Install:</strong> unzip the download, open <code>chrome://extensions</code>, enable Developer mode, choose <strong>Load unpacked</strong>, and select the extracted folder.</p>`;
    }).catch(() => { release.innerHTML = '<div class="empty">Release metadata could not be loaded. Check that the Chrome plugin service is running.</div>'; });
  </script>
</body>
</html>"""
