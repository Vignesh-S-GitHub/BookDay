"""Small API and escaped, bundled HTMX fragments."""

from datetime import date, time
from typing import Literal
from urllib.parse import parse_qs

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse
from jinja2 import DictLoader, Environment, select_autoescape
from pydantic import BaseModel, Field, ValidationError, field_validator

from .engine import Rule, calculate

app = FastAPI(title="BookDay", docs_url=None, redoc_url=None)
templates = Environment(
    loader=DictLoader(
        {
            "result.html": '<article class="bd-card result" data-result=\'{{ result | tojson }}\'><span class="badge">{{ result.status }}</span><h2>Booking opens</h2><p class="opening-date">{{ result.opening_date or "Not announced yet" }}</p><p>{{ result.opening_time or "Time unknown · all-day reminder" }}</p><p>{{ result.rule }}</p><p>Event date: {{ result.event_date }}</p><small>{{ result.verification_status or "Rule Unverified" }}</small></article>'
        }
    ),
    autoescape=select_autoescape(["html"]),
)


class Calculation(BaseModel):
    category: Literal[
        "trains",
        "flights",
        "buses",
        "hotels",
        "movies",
        "temples",
        "events",
        "sports",
        "tourism",
        "appointments",
        "government",
        "education",
        "healthcare",
        "custom",
    ] = "custom"
    event_date: date
    mode: Literal[
        "days", "months", "fixed", "weekly", "monthly", "unknown", "tatkal"
    ] = "days"
    amount: int = Field(default=60, ge=0, le=3650)
    opening_time: time | None = None
    fixed_date: date | None = None
    origin_date: date | None = None
    train_class: Literal["ac", "non-ac"] = "ac"

    @field_validator("opening_time")
    @classmethod
    def local_minute_time(cls, value: time | None) -> time | None:
        if value and (value.tzinfo is not None or value.second or value.microsecond):
            raise ValueError("Supply a local IST time with minute precision (HH:MM).")
        return value


def result_for(value: Calculation) -> dict[str, str | bool | None]:
    try:
        verified = value.category == "trains" and (
            value.mode == "tatkal" or (value.mode == "days" and value.amount == 60)
        )
        result = calculate(
            value.event_date,
            Rule(
                **value.model_dump(exclude={"event_date", "category"}),
                verified=verified,
            ),
        )
        if verified:
            result["source"] = (
                "https://contents.irctc.co.in/en/tatkal_faq.pdf"
                if value.mode == "tatkal"
                else "https://www.pib.gov.in/Pressreleaseshare.aspx?PRID=2065879"
            )
            result["verification_status"] = (
                "Verified policy; service exceptions may apply"
            )
        return result
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "app": "BookDay", "timezone": "Asia/Kolkata"}


@app.post("/api/calculate")
async def api_calculate(value: Calculation) -> dict[str, str | bool | None]:
    return result_for(value)


@app.post("/fragments/calculate", response_class=HTMLResponse)
async def fragment(request: Request) -> HTMLResponse:
    body = await request.body()
    if len(body) > 8192:
        raise HTTPException(status_code=413, detail="Form too large.")
    try:
        values = {key: vals[-1] for key, vals in parse_qs(body.decode()).items()}
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=400, detail="Form must be UTF-8.") from exc
    try:
        value = Calculation.model_validate(values)
        result = result_for(value)
    except (ValidationError, HTTPException) as exc:
        message = (
            str(exc.detail)
            if isinstance(exc, HTTPException)
            else "Check the dates and rule values."
        )
        return HTMLResponse(
            templates.from_string('<p role="alert">{{ message }}</p>').render(
                message=message
            ),
            status_code=422,
        )
    return HTMLResponse(templates.get_template("result.html").render(result=result))
