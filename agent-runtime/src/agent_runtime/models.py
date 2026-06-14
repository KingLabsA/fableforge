from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class SessionStatus(str, Enum):
    CREATED = "created"
    RUNNING = "running"
    PAUSED = "paused"
    STOPPED = "stopped"
    ERROR = "error"


class ToolCall(BaseModel):
    name: str
    arguments: dict[str, Any] = Field(default_factory=dict)
    result: Any = None


class Message(BaseModel):
    role: str
    content: str = ""
    tool_calls: list[ToolCall] = Field(default_factory=list)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SessionCreate(BaseModel):
    name: str
    model: str
    system_prompt: str = ""
    tools: list[str] = Field(default_factory=list)


class SessionState(BaseModel):
    session_id: str = Field(default_factory=lambda: uuid.uuid4().hex[:16])
    name: str = ""
    model: str = ""
    system_prompt: str = ""
    tools: list[str] = Field(default_factory=list)
    status: SessionStatus = SessionStatus.CREATED
    memory: dict[str, Any] = Field(default_factory=dict)
    messages: list[Message] = Field(default_factory=list)
    tool_history: list[ToolCall] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SessionResume(BaseModel):
    session_id: str
    checkpoint_id: str | None = None


class MemoryEntry(BaseModel):
    key: str
    value: Any
    embedding: list[float] | None = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class MemorySearchResult(BaseModel):
    key: str
    value: Any
    score: float
    timestamp: datetime


class CheckpointInfo(BaseModel):
    checkpoint_id: str
    session_id: str
    created_at: datetime
    label: str | None = None


class MemoryStoreRequest(BaseModel):
    key: str
    value: Any


class MemoryRetrieveResponse(BaseModel):
    key: str
    value: Any
    timestamp: datetime


class HealthResponse(BaseModel):
    status: str
    uptime_seconds: float
    active_sessions: int
