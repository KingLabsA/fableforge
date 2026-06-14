"""Pydantic models for agent telemetry data."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class SpanStatus(str, Enum):
    OK = "ok"
    ERROR = "error"
    TIMEOUT = "timeout"


class Span(BaseModel):
    """A single tool-call span within an agent session."""

    span_id: str
    session_id: str
    tool_name: str
    input_tokens: int = 0
    output_tokens: int = 0
    cache_read: int = 0
    cache_creation: int = 0
    duration_ms: float = 0.0
    cost_usd: float = 0.0
    status: SpanStatus = SpanStatus.OK
    error: Optional[str] = None
    model: str = "unknown"
    timestamp: Optional[datetime] = None
    metadata: dict = Field(default_factory=dict)


class SessionMetrics(BaseModel):
    """Aggregate metrics for an agent session."""

    session_id: str
    total_tokens: int = 0
    total_cost: float = 0.0
    tool_calls: int = 0
    error_count: int = 0
    recovery_count: int = 0
    duration_seconds: float = 0.0
    avg_tool_duration_ms: float = 0.0
    p50_duration_ms: float = 0.0
    p95_duration_ms: float = 0.0
    p99_duration_ms: float = 0.0
    cache_hit_rate: float = 0.0
    model: str = "unknown"
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None


class ToolMetrics(BaseModel):
    """Aggregate metrics for a specific tool across sessions."""

    tool_name: str
    call_count: int = 0
    avg_duration_ms: float = 0.0
    p50_duration_ms: float = 0.0
    p95_duration_ms: float = 0.0
    error_rate: float = 0.0
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    total_cache_read: int = 0
    total_cache_creation: int = 0
    total_cost_usd: float = 0.0
    token_distribution: dict = Field(default_factory=dict)


class CostReport(BaseModel):
    """Detailed cost breakdown for a session."""

    session_id: str
    input_cost: float = 0.0
    output_cost: float = 0.0
    cache_cost: float = 0.0
    total_cost: float = 0.0
    model: str = "unknown"
    input_tokens: int = 0
    output_tokens: int = 0
    cache_read_tokens: int = 0
    cache_creation_tokens: int = 0
    span_count: int = 0


class ErrorResponse(BaseModel):
    """Structured error record."""

    span_id: str
    session_id: str
    tool_name: str
    error_type: str
    error_message: str
    recovered: bool = False
    timestamp: Optional[datetime] = None


class ErrorReport(BaseModel):
    """Aggregate error report for a session."""

    session_id: str
    total_errors: int = 0
    recovered_errors: int = 0
    recovery_rate: float = 0.0
    errors_by_type: dict[str, int] = Field(default_factory=dict)
    errors: list[ErrorResponse] = Field(default_factory=list)
