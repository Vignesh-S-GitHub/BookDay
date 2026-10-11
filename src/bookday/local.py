"""Optional traditional ASGI host; Worker deployment never runs Uvicorn."""

from pathlib import Path

from fastapi.staticfiles import StaticFiles

from .app import app

app.mount(
    "/",
    StaticFiles(directory=Path(__file__).resolve().parents[2] / "public", html=True),
    name="frontend",
)
