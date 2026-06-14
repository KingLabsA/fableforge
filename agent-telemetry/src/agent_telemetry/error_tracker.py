"""Error tracking and classification for agent traces."""

from __future__ import annotations

import re
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from agent_telemetry.models import ErrorResponse, ErrorReport, Span, SpanStatus
from agent_telemetry.collector import ingest_trace


ERROR_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("bash_error", re.compile(r"(command|bash|shell|exec).*failed|exit code \d+", re.IGNORECASE)),
    ("edit_error", re.compile(r"(edit|replace|insert|delete).*fail|not found|no match", re.IGNORECASE)),
    ("timeout", re.compile(r"timeout|timed out|deadline exceeded", re.IGNORECASE)),
    ("rate_limit", re.compile(r"rate.?limit|429|too many requests", re.IGNORECASE)),
    ("auth_error", re.compile(r"auth|401|403|permission denied|forbidden|unauthorized", re.IGNORECASE)),
    ("context_overflow", re.compile(r"context.*overflow|context.*length|token.?limit|maximum.*context", re.IGNORECASE)),
    ("tool_error", re.compile(r"tool.*(error|fail)|no such tool|invalid.*tool", re.IGNORECASE)),
    ("parse_error", re.compile(r"parse|syntax|json.*decode|invalid.*format", re.IGNORECASE)),
    ("network_error", re.compile(r"network|connection|dns|socket|ECONNREFUSED|ECONNRESET", re.IGNORECASE)),
    ("file_error", re.compile(r"file.*not found|ENOENT|no such file|cannot read", re.IGNORECASE)),
    ("memory_error", re.compile(r"out of memory|OOM|memory.*exceeded|heap", re.IGNORECASE)),
    ("validation_error", re.compile(r"validation|invalid.*argument|type.*error|value.*error", re.IGNORECASE)),
]


def classify_error(error_text: str) -> str:
    """Classify an error message into a known category.

    Returns the first matching category or ``"unknown"`` if no pattern matches.
    """
    if not error_text:
        return "unknown"

    for category, pattern in ERROR_PATTERNS:
        if pattern.search(error_text):
            return category

    return "unknown"


def detect_errors(trace_data: list[dict[str, Any]] | list[Span]) -> list[ErrorResponse]:
    """Find error patterns in a list of spans or raw dicts.

    For each span with ``status == "error"`` or a non-empty ``error`` field,
    create an ``ErrorResponse`` with the classified error type.
    """
    errors: list[ErrorResponse] = []

    for item in trace_data:
        if isinstance(item, Span):
            error_text = item.error or ""
            status = item.status
            tool_name = item.tool_name
            span_id = item.span_id
            session_id = item.session_id
            timestamp = item.timestamp
        elif isinstance(item, dict):
            error_text = item.get("error", "") or ""
            status_val = item.get("status", "ok")
            status = SpanStatus.ERROR if status_val in ("error", "ERROR") else SpanStatus(status_val) if isinstance(status_val, str) and status_val in SpanStatus._value2member_map_ else SpanStatus.OK
            tool_name = item.get("tool_name", "unknown")
            span_id = item.get("span_id", "")
            session_id = item.get("session_id", "unknown")
            ts = item.get("timestamp")
            timestamp = None
            if isinstance(ts, str):
                try:
                    timestamp = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                except (ValueError, AttributeError):
                    pass
        else:
            continue

        if status == SpanStatus.ERROR or error_text:
            error_type = classify_error(error_text) if error_text else "unknown"
            errors.append(ErrorResponse(
                span_id=span_id,
                session_id=session_id,
                tool_name=tool_name,
                error_type=error_type,
                error_message=error_text[:500],
                recovered=False,
                timestamp=timestamp,
            ))

    return errors


def calculate_recovery_rate(errors: list[ErrorResponse], traces: list[Span]) -> float:
    """Calculate what fraction of errors were followed by a successful operation.

    An error is considered "recovered" if the next span in the same session
    using the same tool succeeds.
    """
    if not errors:
        return 1.0

    session_spans: dict[str, list[Span]] = {}
    for s in traces:
        session_spans.setdefault(s.session_id, []).append(s)

    for sid in session_spans:
        session_spans[sid].sort(key=lambda s: s.timestamp or datetime.min)

    recovered = 0
    for err in errors:
        spans = session_spans.get(err.session_id, [])
        for i, span in enumerate(spans):
            if span.span_id == err.span_id and i + 1 < len(spans):
                next_span = spans[i + 1]
                if next_span.tool_name == err.tool_name and next_span.status == SpanStatus.OK:
                    err.recovered = True
                    recovered += 1
                    break

    return recovered / len(errors)


def generate_error_report(session_id: str, trace_path: Optional[str | Path] = None, spans: Optional[list[Span]] = None) -> ErrorReport:
    """Generate a full error report for a session.

    Provide either *trace_path* (to load spans from a file) or *spans* directly.
    """
    if spans is None and trace_path is not None:
        spans = ingest_trace(trace_path)
    elif spans is None:
        spans = []

    session_spans = [s for s in spans if s.session_id == session_id]
    errors = detect_errors(session_spans)
    recovery_rate = calculate_recovery_rate(errors, session_spans)

    by_type: Counter[str] = Counter()
    for e in errors:
        by_type[e.error_type] += 1

    return ErrorReport(
        session_id=session_id,
        total_errors=len(errors),
        recovered_errors=sum(1 for e in errors if e.recovered),
        recovery_rate=recovery_rate,
        errors_by_type=dict(by_type),
        errors=errors,
    )
