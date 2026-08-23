import asyncio

from app.main import app


def test_health() -> None:
    response_body = bytearray()

    async def receive() -> dict[str, object]:
        return {"type": "http.request", "body": b"", "more_body": False}

    async def send(message: dict[str, object]) -> None:
        if message["type"] == "http.response.body":
            response_body.extend(message.get("body", b""))

    asyncio.run(
        app(
            {
                "type": "http",
                "method": "GET",
                "path": "/health",
                "raw_path": b"/health",
                "query_string": b"",
                "headers": [],
                "scheme": "http",
                "server": ("testserver", 80),
                "client": ("testclient", 50000),
                "http_version": "1.1",
            },
            receive,
            send,
        )
    )

    assert bytes(response_body) == b'{"status":"ok"}'
