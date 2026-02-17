"""Simple in-memory rate limiter for symptom analysis endpoints."""
import os
import time
from collections import defaultdict

# Per-user (or per-IP) list of request timestamps; we prune older than window.
_request_times: dict[str, list[float]] = defaultdict(list)

# Default: 10 requests per minute per user. Set RATE_LIMIT_PER_MINUTE in .env to override.
RATE_LIMIT_WINDOW_SECONDS = 60
RATE_LIMIT_MAX_REQUESTS = int(os.getenv("RATE_LIMIT_PER_MINUTE", "10"))


def _prune(timestamps: list[float], window_secs: float) -> None:
    """Drop timestamps older than window_secs from the list (mutates in place)."""
    cutoff = time.monotonic() - window_secs
    while timestamps and timestamps[0] < cutoff:
        timestamps.pop(0)


def check_rate_limit(identifier: str) -> tuple[bool, int | None]:
    """
    Record a request and check if it's within rate limit.
    identifier: e.g. user_id from session or request.remote_addr.
    Returns (allowed, retry_after_seconds). retry_after_seconds is set when not allowed.
    """
    now = time.monotonic()
    timestamps = _request_times[identifier]
    _prune(timestamps, RATE_LIMIT_WINDOW_SECONDS)

    if len(timestamps) >= RATE_LIMIT_MAX_REQUESTS:
        # Oldest in window is when one slot will free up
        retry_after = max(1, int(timestamps[0] + RATE_LIMIT_WINDOW_SECONDS - now))
        return False, retry_after

    timestamps.append(now)
    return True, None
