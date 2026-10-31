def sse(obj: dict) -> str:
    import json
    return f"data: {json.dumps(obj)}\n\n"


def test_sse_delta():
    result = sse({"type": "delta", "text": "hello"})
    assert result == "data: {\"type\": \"delta\", \"text\": \"hello\"}\n\n"


def test_sse_done():
    result = sse({"type": "done", "truncated": False})
    assert "data: {\"type\": \"done\", \"truncated\": false}\n\n" == result


def test_sse_error():
    result = sse({"type": "error", "code": "rate_limited"})
    assert "data: {\"type\": \"error\", \"code\": \"rate_limited\"}\n\n" == result


def test_sse_error_unknown_code():
    result = sse({"type": "error", "code": "unknown"})
    assert "data: {\"type\": \"error\", \"code\": \"unknown\"}\n\n" == result
