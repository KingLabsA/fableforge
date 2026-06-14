"""Token analyzer for identifying waste in agent traces."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from cost_optimizer.pricing import PricingData


@dataclass
class WasteItem:
    """A single waste instance found in traces."""

    waste_type: str        # "redundant_read", "over_verification", "repeated_tool", "excessive_context"
    description: str
    tokens_wasted: int
    cost_wasted_usd: float
    session_id: str = ""
    turn_indices: list[int] = field(default_factory=list)
    suggestion: str = ""


@dataclass
class TokenReport:
    """Full analysis report of token usage."""

    total_input_tokens: int = 0
    total_output_tokens: int = 0
    total_tokens: int = 0
    total_cost_usd: float = 0.0
    model_used: str = ""
    num_sessions: int = 0
    num_turns: int = 0
    waste_items: list[WasteItem] = field(default_factory=list)
    potential_savings_usd: float = 0.0
    potential_savings_pct: float = 0.0

    @property
    def waste_by_type(self) -> dict[str, int]:
        counts: dict[str, int] = {}
        for w in self.waste_items:
            counts[w.waste_type] = counts.get(w.waste_type, 0) + 1
        return counts

    @property
    def total_waste_tokens(self) -> int:
        return sum(w.tokens_wasted for w in self.waste_items)

    @property
    def total_waste_cost(self) -> float:
        return sum(w.cost_wasted_usd for w in self.waste_items)


def _load_traces(path: str | Path) -> list[dict[str, Any]]:
    traces = []
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line:
                traces.append(json.loads(line))
    return traces


def _extract_tokens(entry: dict[str, Any]) -> tuple[int, int]:
    """Extract (input_tokens, output_tokens) from a trace entry."""
    usage = entry.get("usage", {})
    if usage:
        return usage.get("input_tokens", 0), usage.get("output_tokens", 0)

    input_t = entry.get("input_tokens", entry.get("prompt_tokens", 0))
    output_t = entry.get("output_tokens", entry.get("completion_tokens", 0))

    content = entry.get("content", "")
    if isinstance(content, str):
        if input_t == 0 and output_t == 0:
            input_t = max(0, len(content) // 4)
            output_t = max(0, len(content) // 4)
    elif isinstance(content, list):
        for block in content:
            if isinstance(block, dict):
                text = block.get("text", "") or json.dumps(block.get("input", {}))
                if input_t == 0 and output_t == 0:
                    output_t += len(text) // 4

    return input_t, output_t


def _extract_tool_name(entry: dict[str, Any]) -> str:
    """Extract tool name from a trace entry."""
    content = entry.get("content", [])
    if isinstance(content, list):
        for block in content:
            if isinstance(block, dict) and block.get("type") == "tool_use":
                return block.get("name", "unknown")
    tool = entry.get("tool", entry.get("tool_name", entry.get("function", "")))
    return str(tool) if tool else ""


class TokenAnalyzer:
    """Analyze agent traces to identify token waste and savings opportunities."""

    def __init__(self, default_model: str = "claude-3-5-sonnet-20241022") -> None:
        self.default_model = default_model
        self._pricing = PricingData()

    def analyze_trace(self, traces: str | Path | list[dict[str, Any]]) -> TokenReport:
        """Analyze traces and produce a full token report.

        Args:
            traces: Path to JSONL file or list of trace dicts.

        Returns:
            TokenReport with waste analysis and savings estimates.
        """
        if isinstance(traces, (str, Path)):
            trace_data = _load_traces(traces)
        else:
            trace_data = traces

        report = TokenReport(model_used=self.default_model)

        sessions: dict[str, list[dict[str, Any]]] = {}
        total_input = 0
        total_output = 0

        for entry in trace_data:
            session_id = entry.get("session_id", entry.get("conversation_id", "default"))
            if session_id not in sessions:
                sessions[session_id] = []
            sessions[session_id].append(entry)
            report.num_turns += 1

            inp, out = _extract_tokens(entry)
            total_input += inp
            total_output += out

        report.total_input_tokens = total_input
        report.total_output_tokens = total_output
        report.total_tokens = total_input + total_output
        report.num_sessions = len(sessions)

        model_pricing = self._pricing.get_model(self.default_model)
        if model_pricing:
            report.total_cost_usd = model_pricing.calculate_cost(total_input, total_output)
        else:
            report.total_cost_usd = 0.0

        waste_items: list[WasteItem] = []
        waste_items.extend(self._find_redundant_reads(trace_data))
        waste_items.extend(self._find_over_verification(trace_data))
        waste_items.extend(self._find_repeated_tools(trace_data))
        waste_items.extend(self._find_excessive_context(trace_data))

        report.waste_items = waste_items
        total_waste_cost = sum(w.cost_wasted_usd for w in waste_items)
        report.potential_savings_usd = total_waste_cost
        report.potential_savings_pct = (total_waste_cost / report.total_cost_usd * 100) if report.total_cost_usd > 0 else 0.0

        return report

    def identify_waste(self, traces: str | Path | list[dict[str, Any]]) -> list[WasteItem]:
        """Identify waste in traces without computing full report."""
        if isinstance(traces, (str, Path)):
            trace_data = _load_traces(traces)
        else:
            trace_data = traces

        waste: list[WasteItem] = []
        waste.extend(self._find_redundant_reads(trace_data))
        waste.extend(self._find_over_verification(trace_data))
        waste.extend(self._find_repeated_tools(trace_data))
        waste.extend(self._find_excessive_context(trace_data))
        return waste

    def calculate_savings(self, report: TokenReport) -> float:
        """Calculate total potential savings from identified waste."""
        return report.total_waste_cost

    def generate_report(self, traces: str | Path | list[dict[str, Any]]) -> str:
        """Generate a human-readable text report."""
        report = self.analyze_trace(traces)

        lines = [
            "=" * 60,
            "TOKEN WASTE ANALYSIS REPORT",
            "=" * 60,
            "",
            f"Model:             {report.model_used}",
            f"Sessions:           {report.num_sessions}",
            f"Total Turns:        {report.num_turns}",
            f"Total Input Tokens:  {report.total_input_tokens:,}",
            f"Total Output Tokens: {report.total_output_tokens:,}",
            f"Total Tokens:        {report.total_tokens:,}",
            f"Total Cost:          ${report.total_cost_usd:.4f}",
            "",
            "-" * 60,
            "WASTE IDENTIFIED",
            "-" * 60,
        ]

        if not report.waste_items:
            lines.append("  No significant waste detected.")
        else:
            waste_by_type: dict[str, list[WasteItem]] = {}
            for w in report.waste_items:
                waste_by_type.setdefault(w.waste_type, []).append(w)

            for wtype, items in waste_by_type.items():
                total_tokens = sum(i.tokens_wasted for i in items)
                total_cost = sum(i.cost_wasted_usd for i in items)
                lines.append(f"\n  {wtype.replace('_', ' ').title()}:")
                lines.append(f"    Instances: {len(items)}")
                lines.append(f"    Tokens wasted: {total_tokens:,}")
                lines.append(f"    Cost wasted: ${total_cost:.4f}")
                for item in items[:3]:
                    lines.append(f"    - {item.description}")
                    if item.suggestion:
                        lines.append(f"      Suggestion: {item.suggestion}")

        lines.extend([
            "",
            "-" * 60,
            "POTENTIAL SAVINGS",
            "-" * 60,
            f"  Tokens recoverable: {report.total_waste_tokens:,}",
            f"  Cost recoverable:   ${report.potential_savings_usd:.4f}",
            f"  Savings percentage:  {report.potential_savings_pct:.1f}%",
            "",
            "=" * 60,
        ])

        return "\n".join(lines)

    def _find_redundant_reads(self, trace_data: list[dict[str, Any]]) -> list[WasteItem]:
        """Find instances of reading the same file/content multiple times."""
        waste: list[WasteItem] = []
        file_reads: dict[str, list[int]] = {}

        for i, entry in enumerate(trace_data):
            tool = _extract_tool_name(entry)
            if tool.lower() in ("read", "file_read", "cat", "get_file_contents"):
                content = entry.get("content", "")
                if isinstance(content, list):
                    for block in content:
                        if isinstance(block, dict) and block.get("type") == "tool_use":
                            path = block.get("input", {}).get("file_path", block.get("input", {}).get("path", ""))
                        else:
                            path = ""
                elif isinstance(content, str):
                    path = content[:200]
                else:
                    path = ""

                path = entry.get("file_path", entry.get("path", path))
                if path:
                    if path not in file_reads:
                        file_reads[path] = []
                    file_reads[path].append(i)

        for path, indices in file_reads.items():
            if len(indices) > 1:
                tokens_wasted = len(indices) * 200
                cost_wasted = tokens_wasted * 3.0 / 1_000_000
                waste.append(WasteItem(
                    waste_type="redundant_read",
                    description=f"File '{path}' read {len(indices)} times in same session",
                    tokens_wasted=tokens_wasted,
                    cost_wasted_usd=cost_wasted,
                    turn_indices=indices,
                    suggestion="Cache file reads or reference previous context instead of re-reading",
                ))
        return waste

    def _find_over_verification(self, trace_data: list[dict[str, Any]]) -> list[WasteItem]:
        """Find excessive verification loops (Edit followed immediately by Read of same file)."""
        waste: list[WasteItem] = []

        for i in range(1, len(trace_data)):
            prev_tool = _extract_tool_name(trace_data[i - 1])
            curr_tool = _extract_tool_name(trace_data[i])

            edit_tools = {"edit", "file_edit", "write", "file_write", "apply_edit"}
            verify_tools = {"read", "file_read", "cat", "get_file_contents", "check"}

            if prev_tool in edit_tools and curr_tool in verify_tools:
                prev_path = ""
                content = trace_data[i - 1].get("content", "")
                if isinstance(content, list):
                    for block in content:
                        if isinstance(block, dict) and block.get("type") == "tool_use":
                            prev_path = block.get("input", {}).get("file_path", "")
                prev_path = trace_data[i - 1].get("file_path", trace_data[i - 1].get("path", prev_path))

                curr_path = ""
                content = trace_data[i].get("content", "")
                if isinstance(content, list):
                    for block in content:
                        if isinstance(block, dict) and block.get("type") == "tool_use":
                            curr_path = block.get("input", {}).get("file_path", "")
                curr_path = trace_data[i].get("file_path", trace_data[i].get("path", curr_path))

                if prev_path and curr_path and prev_path == curr_path:
                    _, output_tokens = _extract_tokens(trace_data[i])
                    waste.append(WasteItem(
                        waste_type="over_verification",
                        description=f"Read '{prev_path}' immediately after editing it",
                        tokens_wasted=max(output_tokens, 500),
                        cost_wasted_usd=max(output_tokens * 15.0 / 1_000_000, 0.01),
                        turn_indices=[i - 1, i],
                        suggestion="Skip verification read; rely on strict edit operations",
                    ))
        return waste

    def _find_repeated_tools(self, trace_data: list[dict[str, Any]]) -> list[WasteItem]:
        """Find tools called with identical or near-identical arguments multiple times."""
        waste: list[WasteItem] = []
        tool_calls: dict[str, list[tuple[int, str]]] = {}

        for i, entry in enumerate(trace_data):
            tool = _extract_tool_name(entry)
            if not tool:
                continue
            args_str = ""
            content = entry.get("content", "")
            if isinstance(content, list):
                for block in content:
                    if isinstance(block, dict) and block.get("type") == "tool_use":
                        args_str = json.dumps(block.get("input", {}), sort_keys=True)
            elif isinstance(content, str):
                args_str = content[:500]

            key = f"{tool}:{args_str[:300]}"
            if key not in tool_calls:
                tool_calls[key] = []
            tool_calls[key].append((i, args_str[:200]))

        for key, calls in tool_calls.items():
            if len(calls) > 2:
                tool_name = key.split(":")[0]
                tokens_wasted = len(calls) * 150
                cost_wasted = tokens_wasted * 3.0 / 1_000_000
                waste.append(WasteItem(
                    waste_type="repeated_tool",
                    description=f"Tool '{tool_name}' called {len(calls)} times with same args",
                    tokens_wasted=tokens_wasted,
                    cost_wasted_usd=cost_wasted,
                    turn_indices=[idx for idx, _ in calls],
                    suggestion="Cache tool results or combine duplicate calls",
                ))
        return waste

    def _find_excessive_context(self, trace_data: list[dict[str, Any]]) -> list[WasteItem]:
        """Find turns with disproportionately large input tokens (excessive context)."""
        waste: list[WasteItem] = []

        if len(trace_data) < 3:
            return waste

        input_tokens_list = []
        for entry in trace_data:
            inp, _ = _extract_tokens(entry)
            input_tokens_list.append(inp)

        if not input_tokens_list:
            return waste

        avg_input = sum(input_tokens_list) / len(input_tokens_list)
        threshold = avg_input * 3

        for i, (entry, inp) in enumerate(zip(trace_data, input_tokens_list)):
            if inp > threshold and inp > 5000:
                waste.append(WasteItem(
                    waste_type="excessive_context",
                    description=f"Turn {i} has {inp:,} input tokens (3x avg of {avg_input:,.0f})",
                    tokens_wasted=int(inp - avg_input),
                    cost_wasted_usd=(inp - avg_input) * 3.0 / 1_000_000,
                    turn_indices=[i],
                    suggestion="Reduce context by summarizing or truncating prior turns",
                ))
        return waste
