"""Request tracing and user-visible error responses.

Every request gets a short trace id that is passed back through the
``x-trace-id`` header and included in error responses. Users can quote the
id when reporting issues, making it easy to correlate frontend failures with
backend logs.
"""

from __future__ import annotations

import logging
import traceback
import uuid

from fastapi import Request
from fastapi.exceptions import HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

TRACE_ID_HEADER = "x-trace-id"
logger = logging.getLogger("altitut.trace")


def _generate_trace_id() -> str:
    return uuid.uuid4().hex[:12]


class TraceIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        trace_id = request.headers.get(TRACE_ID_HEADER) or _generate_trace_id()
        request.state.trace_id = trace_id
        response = await call_next(request)
        response.headers[TRACE_ID_HEADER] = trace_id
        return response


def _current_trace_id(request: Request) -> str:
    return getattr(request.state, "trace_id", None) or _generate_trace_id()


def _error_response(request: Request, status_code: int, message: str) -> JSONResponse:
    trace_id = _current_trace_id(request)
    logger.error("[%s] %s %s returned %d: %s", trace_id, request.method, request.url.path, status_code, message)
    return JSONResponse(
        status_code=status_code,
        content={"error": {"message": message, "trace_id": trace_id}},
        headers={TRACE_ID_HEADER: trace_id},
    )


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    status = exc.status_code
    message = exc.detail if isinstance(exc.detail, str) else "Request failed"
    if status >= 500:
        logger.error("[%s] unhandled HTTP %d at %s:\n%s", getattr(request.state, "trace_id", "unknown"), status, request.url.path, traceback.format_exc())
    return _error_response(request, status, message)


async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    trace_id = _current_trace_id(request)
    logger.error("[%s] unhandled exception at %s:\n%s", trace_id, request.url.path, traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={"error": {"message": "Something went wrong on our side — try again in a moment.", "trace_id": trace_id}},
        headers={TRACE_ID_HEADER: trace_id},
    )


def setup_traceability(app) -> None:
    app.add_middleware(TraceIdMiddleware)
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(Exception, general_exception_handler)
