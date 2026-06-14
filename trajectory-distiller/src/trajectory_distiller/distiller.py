"""Main distiller for converting agent traces to training datasets."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from trajectory_distiller.converter import FormatConverter
from trajectory_distiller.filter import TraceFilter
from trajectory_distiller.splitter import DataSplitter


class Distiller:
    """Main distiller class that orchestrates trace conversion to training datasets.

    Supports input formats: glint, armand0e, vfable, opencoven, victor
    Supports output formats: openai_chat, alpaca, sharegpt, conversation
    """

    INPUT_FORMATS = {"glint", "armand0e", "vfable", "opencoven", "victor"}
    OUTPUT_FORMATS = {"openai_chat", "alpaca", "sharegpt", "conversation"}

    def __init__(self) -> None:
        self.converter = FormatConverter()
        self.filter = TraceFilter()
        self.splitter = DataSplitter()

    def distill(
        self,
        input_path: str | Path,
        input_format: str | None = None,
        output_path: str | Path | None = None,
        output_format: str = "openai_chat",
    ) -> list[dict[str, Any]]:
        """Distill agent traces into a training dataset.

        Args:
            input_path: Path to input file (JSONL).
            input_format: Format of input data. Auto-detected if None.
            output_path: Path to save output. If None, returns data only.
            output_format: Output format. One of: openai_chat, alpaca, sharegpt, conversation.

        Returns:
            List of formatted records.
        """
        if input_format is None:
            input_format = self._detect_format(input_path)

        raw_records = self._load_and_normalize(input_path, input_format)

        if not raw_records:
            return []

        if output_format == "openai_chat":
            result = self.converter.to_openai_chat(raw_records)
        elif output_format == "alpaca":
            result = self.converter.to_alpaca(raw_records)
        elif output_format == "sharegpt":
            result = self.converter.to_sharegpt(raw_records)
        elif output_format == "conversation":
            result = self.converter.to_conversation(raw_records)
        else:
            raise ValueError(f"Unknown output format: {output_format}. Choose from: {self.OUTPUT_FORMATS}")

        if output_path:
            output_path = Path(output_path)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            with open(output_path, "w") as f:
                if output_path.suffix == ".jsonl":
                    for record in result:
                        f.write(json.dumps(record) + "\n")
                else:
                    json.dump(result, f, indent=2)

        return result

    def _detect_format(self, path: str | Path) -> str:
        """Auto-detect the format of the input data.

        Checks the first record's structure to determine format.
        """
        path = Path(path)
        with open(path) as f:
            first_line = f.readline().strip()
            if not first_line:
                return "glint"

        record = json.loads(first_line)

        if "messages" in record and isinstance(record["messages"], list):
            return "openai_chat"
        if "session_id" in record and "turns" in record:
            return "glint"
        if "conversation" in record and isinstance(record["conversation"], list):
            return "armand0e"
        if "trajectory" in record and isinstance(record["trajectory"], list):
            return "vfable"
        if "source" in record and "target" in record:
            return "opencoven"
        if "prompt" in record and "response" in record:
            return "victor"
        if "messages" in record:
            return "openai_chat"

        return "glint"

    def _load_and_normalize(self, path: str | Path, fmt: str) -> list[dict[str, Any]]:
        """Load data from file and normalize to internal format."""
        path = Path(path)
        records: list[dict[str, Any]] = []

        with open(path) as f:
            for line in f:
                line = line.strip()
                if line:
                    records.append(json.loads(line))

        return [self._normalize_record(r, fmt) for r in records]

    def _normalize_record(self, record: dict[str, Any], fmt: str) -> dict[str, Any]:
        """Normalize a single record to internal format.

        Internal format:
        {
            "messages": [{"role": str, "content": str, "tool_use": optional list}, ...],
            "session_id": str,
            "metadata": dict
        }
        """
        if fmt == "glint":
            return self._normalize_glint(record)
        elif fmt == "armand0e":
            return self._normalize_armand0e(record)
        elif fmt == "vfable":
            return self._normalize_vfable(record)
        elif fmt == "opencoven":
            return self._normalize_opencoven(record)
        elif fmt == "victor":
            return self._normalize_victor(record)
        elif fmt == "openai_chat":
            return self._normalize_openai(record)
        else:
            return record

    def _normalize_glint(self, record: dict) -> dict[str, Any]:
        """Normalize Glint format.

        Glint: {session_id, turns: [{role, content, tool_use?, tool_result?}]}
        """
        messages = []
        for turn in record.get("turns", []):
            msg: dict[str, Any] = {"role": turn.get("role", "user"), "content": ""}
            content = turn.get("content", "")
            if isinstance(content, str):
                msg["content"] = content
            elif isinstance(content, list):
                text_parts = []
                tool_uses = []
                for block in content:
                    if isinstance(block, dict):
                        if block.get("type") == "text":
                            text_parts.append(block.get("text", ""))
                        elif block.get("type") == "tool_use":
                            tool_uses.append({"name": block.get("name", ""), "input": block.get("input", {})})
                        elif block.get("type") == "tool_result":
                            text_parts.append(f"[Tool Result: {json.dumps(block.get('content', ''))[:200]}]")
                msg["content"] = "\n".join(text_parts) if text_parts else ""
                if tool_uses:
                    msg["tool_use"] = tool_uses
            else:
                msg["content"] = str(content)

            tool_result = turn.get("tool_result")
            if tool_result:
                if isinstance(tool_result, str):
                    msg["content"] += f"\n[Tool Result: {tool_result[:200]}]"
                elif isinstance(tool_result, dict):
                    msg["content"] += f"\n[Tool Result: {json.dumps(tool_result)[:200]}]"
            messages.append(msg)

        return {
            "messages": messages,
            "session_id": record.get("session_id", ""),
            "metadata": record.get("metadata", {}),
        }

    def _normalize_armand0e(self, record: dict) -> dict[str, Any]:
        """Normalize armand0e format.

        armand0e: {conversation: [{role, content, tool_calls?}]}
        """
        messages = []
        for turn in record.get("conversation", []):
            msg: dict[str, Any] = {
                "role": turn.get("role", "user"),
                "content": turn.get("content", ""),
            }
            tool_calls = turn.get("tool_calls")
            if tool_calls and isinstance(tool_calls, list):
                msg["tool_use"] = [{"name": tc.get("function", {}).get("name", ""), "input": tc.get("function", {}).get("arguments", {})} for tc in tool_calls]
            messages.append(msg)

        return {
            "messages": messages,
            "session_id": record.get("id", record.get("session_id", "")),
            "metadata": record.get("metadata", {}),
        }

    def _normalize_vfable(self, record: dict) -> dict[str, Any]:
        """Normalize vfable format.

        vfable: {trajectory: [{role, content, tool_use?}]}
        """
        messages = []
        for turn in record.get("trajectory", []):
            msg: dict[str, Any] = {
                "role": turn.get("role", "user"),
                "content": turn.get("content", ""),
            }
            tool_use = turn.get("tool_use")
            if tool_use and isinstance(tool_use, dict):
                msg["tool_use"] = [{"name": tool_use.get("name", ""), "input": tool_use.get("input", {})}]
            messages.append(msg)

        return {
            "messages": messages,
            "session_id": record.get("id", record.get("session_id", "")),
            "metadata": record.get("metadata", {}),
        }

    def _normalize_opencoven(self, record: dict) -> dict[str, Any]:
        """Normalize opencoven format.

        opencoven: {source: str, target: str, ...metadata}
        """
        return {
            "messages": [
                {"role": "user", "content": record.get("source", "")},
                {"role": "assistant", "content": record.get("target", "")},
            ],
            "session_id": record.get("id", ""),
            "metadata": {k: v for k, v in record.items() if k not in ("source", "target", "id")},
        }

    def _normalize_victor(self, record: dict) -> dict[str, Any]:
        """Normalize victor format.

        victor: {prompt: str, response: str, ...metadata}
        """
        messages = [{"role": "user", "content": record.get("prompt", "")}]

        response = record.get("response", "")
        if isinstance(response, str):
            messages.append({"role": "assistant", "content": response})
        elif isinstance(response, list):
            for r in response:
                if isinstance(r, dict):
                    messages.append({"role": r.get("role", "assistant"), "content": r.get("content", str(r))})
                else:
                    messages.append({"role": "assistant", "content": str(r)})
        else:
            messages.append({"role": "assistant", "content": str(response)})

        return {
            "messages": messages,
            "session_id": record.get("id", record.get("session_id", "")),
            "metadata": {k: v for k, v in record.items() if k not in ("prompt", "response", "id", "session_id")},
        }

    def _normalize_openai(self, record: dict) -> dict[str, Any]:
        """Normalize OpenAI chat format (already close to internal)."""
        messages = []
        for msg in record.get("messages", []):
            m: dict[str, Any] = {"role": msg.get("role", "user"), "content": msg.get("content", "")}
            tool_calls = msg.get("tool_calls")
            if tool_calls:
                m["tool_use"] = [
                    {"name": tc.get("function", {}).get("name", ""), "input": tc.get("function", {}).get("arguments", {})}
                    for tc in tool_calls
                ]
            messages.append(m)

        return {
            "messages": messages,
            "session_id": record.get("id", ""),
            "metadata": record.get("metadata", {}),
        }
