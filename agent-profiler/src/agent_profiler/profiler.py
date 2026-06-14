"""Core profiler for analyzing agent sessions."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import numpy as np

from agent_profiler.classifier import BehaviorClassifier


@dataclass
class ToolDistribution:
    """Distribution of tool usage in a session."""

    tool_counts: dict[str, int] = field(default_factory=dict)
    total_calls: int = 0

    @property
    def frequencies(self) -> dict[str, float]:
        if self.total_calls == 0:
            return {}
        return {tool: count / self.total_calls for tool, count in self.tool_counts.items()}

    @property
    def dominant_tool(self) -> str:
        if not self.tool_counts:
            return "none"
        return max(self.tool_counts, key=self.tool_counts.get)  # type: ignore[arg-type]

    @property
    def entropy(self) -> float:
        freqs = list(self.frequencies.values())
        if not freqs or sum(freqs) == 0:
            return 0.0
        freqs_arr = np.array(freqs)
        freqs_arr = freqs_arr[freqs_arr > 0]
        return float(-np.sum(freqs_arr * np.log2(freqs_arr)))


@dataclass
class TransitionAnalysis:
    """Analysis of tool transition patterns."""

    transitions: dict[str, dict[str, int]] = field(default_factory=dict)
    total_transitions: int = 0

    @property
    def transition_probabilities(self) -> dict[str, dict[str, float]]:
        probs: dict[str, dict[str, float]] = {}
        for from_tool, to_tools in self.transitions.items():
            total = sum(to_tools.values())
            if total > 0:
                probs[from_tool] = {t: c / total for t, c in to_tools.items()}
            else:
                probs[from_tool] = {}
        return probs

    @property
    def circular_ratio(self) -> float:
        """Ratio of transitions that go back to a recently-used tool (A→B→A pattern)."""
        if self.total_transitions == 0:
            return 0.0
        circular_count = 0
        for from_tool, to_tools in self.transitions.items():
            if from_tool in to_tools:
                circular_count += to_tools[from_tool]
        return circular_count / self.total_transitions


@dataclass
class ProfileResult:
    """Result of agent session profiling."""

    category: str                # debugging, building, exploring, lost, verifying
    confidence: float            # 0.0 - 1.0
    tool_distribution: ToolDistribution = field(default_factory=ToolDistribution)
    transition_analysis: TransitionAnalysis = field(default_factory=TransitionAnalysis)
    session_duration: float = 0.0    # seconds
    num_turns: int = 0
    error_rate: float = 0.0
    edit_ratio: float = 0.0     # edit calls / total calls
    read_ratio: float = 0.0     # read calls / total calls
    grep_ratio: float = 0.0     # grep/search calls / total calls
    bash_ratio: float = 0.0     # bash/shell calls / total calls
    write_ratio: float = 0.0    # write calls / total calls
    error_recovery_rate: float = 0.0
    sub_categories: list[str] = field(default_factory=list)
    profile_scores: dict[str, float] = field(default_factory=dict)

    def __str__(self) -> str:
        return (f"ProfileResult(category={self.category}, confidence={self.confidence:.2f}, "
                f"turns={self.num_turns}, duration={self.session_duration:.1f}s)")


def _load_traces(path: str | Path) -> list[dict[str, Any]]:
    traces = []
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line:
                traces.append(json.loads(line))
    return traces


def _extract_tool(entry: dict[str, Any]) -> str:
    """Extract tool name from a trace entry."""
    content = entry.get("content", [])
    if isinstance(content, list):
        for block in content:
            if isinstance(block, dict) and block.get("type") == "tool_use":
                name = block.get("name", "")
                if name:
                    return name
    tool = entry.get("tool", entry.get("tool_name", entry.get("function", "")))
    return str(tool).lower() if tool else ""


def _normalize_tool(raw_tool: str) -> str:
    """Normalize tool names to canonical forms."""
    tool = raw_tool.lower().strip()
    read_names = {"read", "file_read", "cat", "get_file_contents", "view", "open"}
    edit_names = {"edit", "file_edit", "apply_edit", "replace", "str_replace_editor"}
    write_names = {"write", "file_write", "create_file", "create"}
    bash_names = {"bash", "shell", "run", "execute", "terminal", "command"}
    grep_names = {"grep", "search", "find", "glob", "rg", "ag"}
    test_names = {"test", "pytest", "run_test", "unittest"}

    if tool in read_names:
        return "read"
    if tool in edit_names:
        return "edit"
    if tool in write_names:
        return "write"
    if tool in bash_names:
        return "bash"
    if tool in grep_names:
        return "grep"
    if tool in test_names:
        return "bash"
    return tool if tool else "unknown"


def _has_error(entry: dict[str, Any]) -> bool:
    """Check if a trace entry indicates an error."""
    content = entry.get("content", [])
    if isinstance(content, list):
        for block in content:
            if isinstance(block, dict):
                if block.get("type") == "tool_result" and block.get("is_error", False):
                    return True
                text = block.get("text", "")
                if isinstance(text, str):
                    error_markers = ["error", "exception", "traceback", "failed", "failure"]
                    if any(m in text.lower() for m in error_markers):
                        return True
    role = entry.get("role", "")
    if role == "assistant":
        text = ""
        if isinstance(content, list):
            for block in content:
                if isinstance(block, dict) and block.get("type") == "text":
                    text += block.get("text", "")
        elif isinstance(content, str):
            text = content
        error_in_response = ["sorry", "i made a mistake", "let me fix", "correction", "that was wrong"]
        return any(m in text.lower() for m in error_in_response)
    return False


class AgentProfiler:
    """Profile agent sessions and classify behavior patterns."""

    def __init__(self) -> None:
        self.classifier = BehaviorClassifier()

    def profile(self, session: str | Path | list[dict[str, Any]]) -> ProfileResult:
        """Profile an agent session and classify its behavior.

        Args:
            session: Path to JSONL trace file, or list of trace dicts.

        Returns:
            ProfileResult with category, confidence, and detailed metrics.
        """
        if isinstance(session, (str, Path)):
            trace_data = _load_traces(session)
        else:
            trace_data = session

        tool_dist = self._compute_tool_distribution(trace_data)
        transitions = self._compute_transitions(trace_data)
        error_rate = self._compute_error_rate(trace_data)
        duration = self._compute_duration(trace_data)

        edit_ratio = tool_dist.frequencies.get("edit", 0.0)
        read_ratio = tool_dist.frequencies.get("read", 0.0)
        grep_ratio = tool_dist.frequencies.get("grep", 0.0)
        bash_ratio = tool_dist.frequencies.get("bash", 0.0)
        write_ratio = tool_dist.frequencies.get("write", 0.0)
        error_recovery = self._compute_error_recovery(trace_data)

        profile_scores = self.classifier.compute_scores(
            edit_ratio=edit_ratio,
            read_ratio=read_ratio,
            grep_ratio=grep_ratio,
            bash_ratio=bash_ratio,
            write_ratio=write_ratio,
            error_rate=error_rate,
            error_recovery_rate=error_recovery,
            circular_ratio=transitions.circular_ratio,
            entropy=tool_dist.entropy,
            num_turns=len(trace_data),
        )

        best_category = max(profile_scores, key=profile_scores.get)  # type: ignore[arg-type]
        confidence = profile_scores[best_category]

        sub_categories = [cat for cat, score in profile_scores.items()
                         if score > 0.3 and cat != best_category]

        return ProfileResult(
            category=best_category,
            confidence=confidence,
            tool_distribution=tool_dist,
            transition_analysis=transitions,
            session_duration=duration,
            num_turns=len(trace_data),
            error_rate=error_rate,
            edit_ratio=edit_ratio,
            read_ratio=read_ratio,
            grep_ratio=grep_ratio,
            bash_ratio=bash_ratio,
            write_ratio=write_ratio,
            error_recovery_rate=error_recovery,
            sub_categories=sub_categories,
            profile_scores=profile_scores,
        )

    def _compute_tool_distribution(self, trace_data: list[dict[str, Any]]) -> ToolDistribution:
        tool_counts: dict[str, int] = {}
        total = 0
        for entry in trace_data:
            raw_tool = _extract_tool(entry)
            if raw_tool:
                tool = _normalize_tool(raw_tool)
                tool_counts[tool] = tool_counts.get(tool, 0) + 1
                total += 1
        return ToolDistribution(tool_counts=tool_counts, total_calls=total)

    def _compute_transitions(self, trace_data: list[dict[str, Any]]) -> TransitionAnalysis:
        transitions: dict[str, dict[str, int]] = {}
        total = 0
        prev_tool = ""
        for entry in trace_data:
            raw_tool = _extract_tool(entry)
            if raw_tool:
                tool = _normalize_tool(raw_tool)
                if prev_tool and tool:
                    if prev_tool not in transitions:
                        transitions[prev_tool] = {}
                    transitions[prev_tool][tool] = transitions[prev_tool].get(tool, 0) + 1
                    total += 1
                prev_tool = tool
        return TransitionAnalysis(transitions=transitions, total_transitions=total)

    def _compute_error_rate(self, trace_data: list[dict[str, Any]]) -> float:
        if not trace_data:
            return 0.0
        errors = sum(1 for entry in trace_data if _has_error(entry))
        return errors / len(trace_data)

    def _compute_duration(self, trace_data: list[dict[str, Any]]) -> float:
        if not trace_data:
            return 0.0
        timestamps: list[float] = []
        for entry in trace_data:
            ts = entry.get("timestamp", entry.get("created_at", ""))
            if isinstance(ts, (int, float)):
                timestamps.append(float(ts))
            elif isinstance(ts, str) and ts:
                try:
                    from datetime import datetime
                    dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                    timestamps.append(dt.timestamp())
                except (ValueError, AttributeError):
                    pass
        if len(timestamps) >= 2:
            return max(timestamps) - min(timestamps)
        return 0.0

    def _compute_error_recovery(self, trace_data: list[dict[str, Any]]) -> float:
        errors = 0
        recoveries = 0
        had_error = False
        for entry in trace_data:
            if _has_error(entry):
                errors += 1
                had_error = True
            elif had_error:
                recoveries += 1
                had_error = False
        if errors == 0:
            return 1.0
        return recoveries / errors
