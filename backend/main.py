import base64
import json
import os
import time
import uuid
from collections import defaultdict, deque
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

import anthropic
from dotenv import load_dotenv
from fastapi import FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

PORT = int(os.getenv("PORT", "8787"))
MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-5-5")
API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
configured = bool(API_KEY)
client = anthropic.AsyncAnthropic(api_key=API_KEY, timeout=60.0) if configured else None

LENGTHS = {"short": "about 120 words", "medium": "about 300 words", "long": "about 600 words"}
MAX_TOKENS = {"short": 900, "medium": 1600, "long": 3000}
IMAGE_TYPES = {"image/png", "image/jpeg", "image/webp"}
MAX_BODY_BYTES = 8 * 1024 * 1024
RATE_LIMIT = 12          # requests
RATE_WINDOW = 60.0       # seconds, per client IP

# Optional shared rate limiting. Set REDIS_URL (e.g. redis://localhost:6379/0) to share the
# counters between several workers or servers; leave it empty for the in-memory limiter.
REDIS_URL = os.getenv("REDIS_URL", "").strip()
redis_client = None
if REDIS_URL:
    try:
        import redis.asyncio as aioredis

        redis_client = aioredis.from_url(REDIS_URL, decode_responses=True)
    except Exception as e:  # redis not installed: fall back to in-memory limiter
        print("Redis rate limiter unavailable (redis package not installed), using in-memory limiter:", e)
        REDIS_URL = ""

DIST = (BASE_DIR / "../frontend/dist").resolve()

@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    yield
    if redis_client is not None:
        await redis_client.aclose()


app = FastAPI(title="PaperPilot Backend", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ImageIn(BaseModel):
    mediaType: str  # noqa: N815  (field name is part of the frontend API)
    data: str


class GenerateIn(BaseModel):
    question: str = ""
    subject: str = ""
    length: str = "medium"
    image: ImageIn | None = None


@app.exception_handler(RequestValidationError)
async def bad_request(_req: Request, _exc: RequestValidationError) -> JSONResponse:
    return JSONResponse({"code": "bad_request"}, status_code=400)


# ---------- rate limiting: sliding window per client IP ----------
_hits: dict[str, deque] = defaultdict(deque)


def memory_rate_limited(ip: str) -> bool:
    """In-memory limiter: one process only. Used when REDIS_URL is not set, or Redis is down."""
    now = time.monotonic()
    q = _hits[ip]
    while q and now - q[0] > RATE_WINDOW:
        q.popleft()
    if len(q) >= RATE_LIMIT:
        return True
    q.append(now)
    if len(_hits) > 10_000:  # drop idle IPs so the dict cannot grow forever
        for k in [k for k, v in _hits.items() if not v or now - v[-1] > RATE_WINDOW]:
            del _hits[k]
    return False


# Atomic check-and-record, using Redis's own clock so workers on different hosts agree.
# Returns 1 when the request is allowed (and recorded), 0 when the limit is reached.
_SLIDING_WINDOW = """
local t = redis.call('TIME')
local now = tonumber(t[1]) + tonumber(t[2]) / 1000000
redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, now - tonumber(ARGV[1]))
if redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[2]) then
  return 0
end
redis.call('ZADD', KEYS[1], now, ARGV[3])
redis.call('PEXPIRE', KEYS[1], math.ceil(tonumber(ARGV[1]) * 1000))
return 1
"""
_redis_warned = False


async def rate_limited(ip: str) -> bool:
    global _redis_warned
    if redis_client is not None:
        try:
            allowed = await redis_client.eval(
                _SLIDING_WINDOW, 1, f"paperpilot:rl:{ip}", RATE_WINDOW, RATE_LIMIT, uuid.uuid4().hex
            )
            return int(allowed) == 0
        except Exception as e:  # Redis down: fall back to the local limiter instead of failing requests
            if not _redis_warned:
                print("Redis rate limiter unavailable, using in-memory limiter:", e)
                _redis_warned = True
    return memory_rate_limited(ip)


@app.get("/api/health")
def health() -> dict:
    return {"ok": True, "configured": configured, "model": MODEL, "rateLimit": "redis" if redis_client is not None else "memory"}


def build_prompt(question: str, subject: str, length: str, has_image: bool) -> str:
    return "\n\n".join([
        "You are writing the answer for a student's handwritten assignment.",
        f"Subject: {subject or 'general'}. Length for each question: {LENGTHS[length]}. Use simple, student-friendly language and short sentences.",
        "The question paper is in the attached image. Answer every question on it, in order." if has_image else f"Question or assignment:\n{question}",
        'If there are several questions, answer each in order and begin each answer with a heading such as "# Q1. Short title".',
        'Output rules, strictly: plain text only. Use "# " for the main heading, "## " for sub-headings, "- " for bullets and "1. " for numbered steps. Put one blank line before each heading. Do not use bold, asterisks, backticks, tables or code fences. Write maths in plain characters (x^2, O(n log n), <=). For a binary search tree example you may add one line like [bst 50 30 70 20 40] listing the keys in insertion order.',
        "Reply with only the answer text.",
    ])


def sse(obj: dict) -> str:
    return f"data: {json.dumps(obj)}\n\n"


@app.post("/api/generate")
async def generate(body: GenerateIn, request: Request) -> Response:
    ip = request.client.host if request.client else "unknown"
    if await rate_limited(ip):
        return JSONResponse({"code": "rate_limited"}, status_code=429)
    cl = request.headers.get("content-length")
    if cl and int(cl) > MAX_BODY_BYTES:
        return JSONResponse({"code": "too_large"}, status_code=413)
    # Also check body size when Content-Length is absent (chunked encoding): FastAPI caches
    # the raw body in request._body after parsing the model parameter.
    if not cl and hasattr(request, "_body") and len(request._body or b"") > MAX_BODY_BYTES:
        return JSONResponse({"code": "too_large"}, status_code=413)
    if not configured:
        return JSONResponse({"code": "no_key"}, status_code=503)

    question = (body.question or "").strip()[:20000]
    subject = (body.subject or "").strip()[:80]
    length = body.length if body.length in LENGTHS else "medium"
    image = body.image if (body.image and body.image.mediaType in IMAGE_TYPES and body.image.data) else None
    if image:
        try:
            decoded = base64.b64decode(image.data, validate=True)
        except Exception:
            return JSONResponse({"code": "bad_request"}, status_code=400)
        if len(decoded) > 4 * 1024 * 1024:  # 4 MB decoded image limit
            return JSONResponse({"code": "too_large"}, status_code=413)
        image = ImageIn(mediaType=image.mediaType, data=image.data)  # keep original for Anthropic
    else:
        decoded = None
    if not question and not image:
        return JSONResponse({"code": "bad_request"}, status_code=400)

    content = []
    if image:
        content.append({"type": "image", "source": {"type": "base64", "media_type": image.mediaType, "data": image.data}})
    content.append({"type": "text", "text": build_prompt(question, subject, length, bool(image))})

    async def stream() -> AsyncIterator[str]:
        try:
            async with client.messages.stream(
                model=MODEL,
                max_tokens=MAX_TOKENS[length] * (2 if image else 1),
                messages=[{"role": "user", "content": content}],
            ) as s:
                async for text in s.text_stream:
                    yield sse({"type": "delta", "text": text})
                final = await s.get_final_message()
                yield sse({"type": "done", "truncated": final.stop_reason == "max_tokens"})
        except Exception as e:  # client disconnects cancel the generator, which is not caught here
            status = getattr(e, "status_code", None)
            code = "rate_limited" if status == 429 else "too_large" if status == 413 else "failed"
            if code == "failed":
                print("generate failed:", e)
            yield sse({"type": "error", "code": code})

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"},
    )


# Serve the built frontend in production (after `npm run build`)
if DIST.is_dir():
    if (DIST / "assets").is_dir():
        app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str) -> Response:
        if path.startswith("api/"):
            return JSONResponse({"code": "not_found"}, status_code=404)
        f = (DIST / path).resolve()
        if path and f.is_file() and f.is_relative_to(DIST):
            return FileResponse(f)
        return FileResponse(DIST / "index.html")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=PORT)
