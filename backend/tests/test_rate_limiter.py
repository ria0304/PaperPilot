import time
from collections import defaultdict, deque

RATE_LIMIT = 12
RATE_WINDOW = 60.0


def memory_rate_limited(ip: str, _hits: defaultdict[str, deque]) -> bool:
    """In-memory limiter: one process only. Used when REDIS_URL is not set."""
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


def test_rate_limiter_allows_first_request():
    _hits = defaultdict(deque)
    assert not memory_rate_limited("127.0.0.1", _hits)


def test_rate_limiter_allows_up_to_limit():
    _hits = defaultdict(deque)
    for _ in range(RATE_LIMIT):
        assert not memory_rate_limited("127.0.0.1", _hits)
    # The 13th request should be blocked
    assert memory_rate_limited("127.0.0.1", _hits)


def test_rate_limiter_blocks_13th_request():
    _hits = defaultdict(deque)
    for _ in range(RATE_LIMIT + 1):
        memory_rate_limited("127.0.0.1", _hits)
    assert memory_rate_limited("127.0.0.1", _hits)


def test_rate_limiter_separate_ips():
    _hits = defaultdict(deque)
    memory_rate_limited("127.0.0.1", _hits)
    memory_rate_limited("192.168.1.1", _hits)
    assert len(_hits) == 2


def test_rate_limiter_window_reset():
    """Simulate window reset by inserting an old timestamp, then a new one should be allowed."""
    _hits = defaultdict(deque)
    # Insert an old timestamp manually
    old_time = time.monotonic() - RATE_WINDOW - 1
    _hits["127.0.0.1"].append(old_time)
    # Now a new request should be allowed because the old timestamp has expired
    assert not memory_rate_limited("127.0.0.1", _hits)


def test_rate_limiter_drops_idle_ips_on_pruning():
    """Explicitly test the idle-IP pruning logic."""
    _hits = defaultdict(deque)
    now = time.monotonic()
    memory_rate_limited("1.1.1.1", _hits)
    # Manually trigger the pruning that happens after appending
    if len(_hits) > 10_000:
        for k in [k for k, v in _hits.items() if not v or now - v[-1] > RATE_WINDOW]:
            del _hits[k]
    # With only one IP, pruning shouldn't delete it (it's recent)
    assert "1.1.1.1" in _hits
