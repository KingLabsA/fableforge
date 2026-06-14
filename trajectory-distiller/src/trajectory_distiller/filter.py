"""Filter traces by tool, error rate, session length, and quality."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


class TraceFilter:
    """Filter traces based on various criteria."""

    def filter_by_tool(
        self,
        records: list[dict[str, Any]] | str | Path,
        tools: list[str],
    ) -> list[dict[str, Any]]:
        """Filter records to only those that use specific tools.

        Args:
            records: List of normalized records, or path to JSONL file.
            tools: List of tool names to include (case-insensitive).

        Returns:
            Filtered list of records that contain at least one of the specified tools.
        """
        if isinstance(records, (str, Path)):
            records = self._load_records(records)

        tools_lower = {t.lower() for t in tools}
        result = []
        for record in records:
            messages = record.get("messages", [])
            has_tool = False
            for msg in messages:
                for tu in msg.get("tool_use", []):
                    name = tu.get("name", "").lower()
                    if name in tools_lower:
                        has_tool = True
                        break
                content = msg.get("content", "")
                for tool in tools_lower:
                    if tool in content.lower():
                        has_tool = True
                        break
                if has_tool:
                    break
            if has_tool:
                result.append(record)
        return result

    def filter_by_error_rate(
        self,
        records: list[dict[str, Any]] | str | Path,
        min_rate: float = 0.1,
    ) -> list[dict[str, Any]]:
        """Filter records to those with at least a minimum error rate.

        Args:
            records: List of normalized records, or path to JSONL file.
            min_rate: Minimum error rate (0.0 to 1.0) to include.

        Returns:
            Filtered list of records with error rate >= min_rate.
        """
        if isinstance(records, (str, Path)):
            records = self._load_records(records)

        result = []
        for record in records:
            messages = record.get("messages", [])
            error_count = 0
            for msg in messages:
                content = msg.get("content", "").lower()
                error_indicators = [
                    "error", "exception", "traceback", "failed", "failure",
                    "sorry", "i made a mistake", "let me fix", "correction",
                    "that was wrong", "not working", "doesn't work", "incorrect",
                ]
                if any(ind in content for ind in error_indicators):
                    error_count += 1

            total = len(messages)
            rate = error_count / total if total > 0 else 0.0
            if rate >= min_rate:
                result.append(record)
        return result

    def filter_by_session_length(
        self,
        records: list[dict[str, Any]] | str | Path,
        min_turns: int = 2,
        max_turns: int = 200,
    ) -> list[dict[str, Any]]:
        """Filter records by session length (number of turns/messages).

        Args:
            records: List of normalized records, or path to JSONL file.
            min_turns: Minimum number of turns to include.
            max_turns: Maximum number of turns to include.

        Returns:
            Filtered list of records within the turn range.
        """
        if isinstance(records, (str, Path)):
            records = self._load_records(records)

        result = []
        for record in records:
            num_turns = len(record.get("messages", []))
            if min_turns <= num_turns <= max_turns:
                result.append(record)
        return result

    def filter_by_quality(
        self,
        records: list[dict[str, Any]] | str | Path,
        min_quality_score: float = 0.3,
    ) -> list[dict[str, Any]]:
        """Filter records by a quality score based on multiple heuristics.

        Quality score considers:
        - Reasoning length (longer = better)
        - Tool diversity (more tools = more complex)
        - Error recovery rate (higher = better)
        - Response completeness

        Args:
            records: List of normalized records, or path to JSONL file.
            min_quality_score: Minimum quality score (0.0 to 1.0).

        Returns:
            Filtered list of records with quality >= min_quality_score.
        """
        if isinstance(records, (str, Path)):
            records = self._load_records(records)

        result = []
        for record in records:
            score = self._compute_quality_score(record)
            if score >= min_quality_score:
                record["_quality_score"] = score
                result.append(record)
        return result

    def _compute_quality_score(self, record: dict[str, Any]) -> float:
        """Compute a quality score for a single record."""
        messages = record.get("messages", [])
        if not messages:
            return 0.0

        scores: dict[str, float] = {}

        total_chars = sum(len(m.get("content", "")) for m in messages)
        reasoning_length = min(total_chars / 5000.0, 1.0)
        scores["reasoning"] = reasoning_length * 0.25

        tools_used: set[str] = set()
        for msg in messages:
            for tu in msg.get("tool_use", []):
                tools_used.add(tu.get("name", ""))
        total_calls = sum(len(m.get("tool_use", [])) for m in messages)
        if total_calls > 0:
            diversity = min(len(tools_used) / max(total_calls, 1), 1.0)
        else:
            diversity = 0.0
        scores["diversity"] = diversity * 0.25

        error_msgs = 0
        recovery_msgs = 0
        had_error = False
        for msg in messages:
            content = msg.get("content", "").lower()
            is_error = any(w in content for w in ["error", "exception", "failed", "traceback"])
            is_recovery = any(w in content for w in ["fixed", "corrected", "now works", "let me fix"])
            if is_error:
                error_msgs += 1
                had_error = True
            if is_recovery and had_error:
                recovery_msgs += 1
                had_error = False

        if error_msgs > 0:
            scores["recovery"] = min(recovery_msgs / error_msgs, 1.0) * 0.25
        else:
            scores["recovery"] = 0.15

        has_assistant = any(m.get("role") == "assistant" for m in messages)
        has_user = any(m.get("role") == "user" for m in messages)
        completeness = 0.5 * (1.0 if has_assistant else 0.0) + 0.5 * (1.0 if has_user else 0.0)
        scores["completeness"] = completeness * 0.25

        return sum(scores.values())

    def _load_records(self, path: str | Path) -> list[dict[str, Any]]:
        """Load records from a JSONL file."""
        records = []
        with open(path) as f:
            for line in f:
                line = line.strip()
                if line:
                    records.append(json.loads(line))
        return records
