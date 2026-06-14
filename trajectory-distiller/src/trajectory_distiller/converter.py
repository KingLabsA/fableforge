"""Format converters for training datasets."""

from __future__ import annotations

import json
import uuid
from typing import Any


class FormatConverter:
    """Convert normalized records to various training dataset formats."""

    def to_openai_chat(self, records: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Convert to OpenAI chat completion format.

        Output format:
        [{"messages": [{"role": "system"|"user"|"assistant", "content": str}, ...], ...}]
        """
        result = []
        for record in records:
            messages = record.get("messages", [])
            formatted_messages = []

            for msg in messages:
                role = msg.get("role", "user")
                content = msg.get("content", "")

                tool_uses = msg.get("tool_use", [])
                if tool_uses:
                    formatted_messages.append({
                        "role": role,
                        "content": content if content else None,
                        "tool_calls": [
                            {
                                "id": f"call_{uuid.uuid4().hex[:8]}",
                                "type": "function",
                                "function": {
                                    "name": tu.get("name", ""),
                                    "arguments": json.dumps(tu.get("input", {})) if isinstance(tu.get("input"), dict) else str(tu.get("input", "")),
                                },
                            }
                            for tu in tool_uses
                        ],
                    })
                elif content:
                    formatted_messages.append({"role": role, "content": content})

            if formatted_messages:
                chat_record: dict[str, Any] = {"messages": formatted_messages}
                session_id = record.get("session_id", "")
                if session_id:
                    chat_record["id"] = session_id

                metadata = record.get("metadata", {})
                if metadata:
                    chat_record["metadata"] = metadata

                result.append(chat_record)

        return result

    def to_alpaca(self, records: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Convert to Alpaca instruction format.

        Output format:
        [{"instruction": str, "input": str (optional), "output": str}, ...]
        """
        result = []
        for record in records:
            messages = record.get("messages", [])

            system_msg = ""
            user_msg = ""
            assistant_msg = ""
            system_parts = []
            user_parts = []
            assistant_parts = []

            for msg in messages:
                role = msg.get("role", "")
                content = msg.get("content", "")
                tool_uses = msg.get("tool_use", [])

                if role == "system":
                    system_parts.append(content)
                elif role == "user":
                    if tool_uses:
                        tool_desc = "\n".join(
                            f"[Used tool: {tu['name']}]"
                            for tu in tool_uses
                        )
                        user_parts.append(f"{content}\n{tool_desc}" if content else tool_desc)
                    else:
                        user_parts.append(content)
                elif role == "assistant":
                    if tool_uses:
                        tool_desc = "\n".join(
                            f"[Called {tu['name']}({json.dumps(tu['input'])})]"
                            for tu in tool_uses
                        )
                        assistant_parts.append(f"{content}\n{tool_desc}" if content else tool_desc)
                    else:
                        assistant_parts.append(content)

            system_msg = "\n".join(system_parts)
            user_msg = "\n".join(user_parts)
            assistant_msg = "\n".join(assistant_parts)

            if user_msg or system_msg:
                alpaca_record: dict[str, Any] = {}
                if system_msg:
                    alpaca_record["instruction"] = f"{system_msg}\n\n{user_msg}" if user_msg else system_msg
                else:
                    alpaca_record["instruction"] = user_msg

                if user_msg and system_msg:
                    alpaca_record["input"] = user_msg
                elif not system_msg:
                    alpaca_record["input"] = ""

                alpaca_record["output"] = assistant_msg

                session_id = record.get("session_id", "")
                if session_id:
                    alpaca_record["id"] = session_id

                metadata = record.get("metadata", {})
                if metadata:
                    alpaca_record["metadata"] = metadata

                result.append(alpaca_record)

        return result

    def to_sharegpt(self, records: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Convert to ShareGPT conversation format.

        Output format:
        [{"conversations": [{"from": "human"|"gpt"|"system", "value": str}, ...]}, ...]
        """
        result = []
        for record in records:
            conversations = []
            for msg in record.get("messages", []):
                role = msg.get("role", "user")
                content = msg.get("content", "")

                tool_uses = msg.get("tool_use", [])
                if tool_uses:
                    tool_content = "\n".join(
                        f"[Tool: {tu['name']}({json.dumps(tu['input'])})]"
                        for tu in tool_uses
                    )
                    content = f"{content}\n{tool_content}" if content else tool_content

                from_role = {"system": "system", "user": "human", "assistant": "gpt"}.get(role, "human")

                if content:
                    conversations.append({"from": from_role, "value": content})

            if conversations:
                sgpt_record: dict[str, Any] = {"conversations": conversations}

                session_id = record.get("session_id", "")
                if session_id:
                    sgpt_record["id"] = session_id

                metadata = record.get("metadata", {})
                if metadata:
                    sgpt_record["metadata"] = metadata

                result.append(sgpt_record)

        return result

    def to_conversation(self, records: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Convert to a general conversation format preserving turn structure.

        Output format:
        [{"id": str, "turns": [{"speaker": str, "text": str, "tools": [...], ...}, ...]}, ...]
        """
        result = []
        for record in records:
            turns = []
            for msg in record.get("messages", []):
                role = msg.get("role", "user")
                content = msg.get("content", "")
                tool_uses = msg.get("tool_use", [])

                turn: dict[str, Any] = {
                    "speaker": role,
                    "text": content,
                }

                if tool_uses:
                    turn["tools"] = [
                        {"name": tu.get("name", ""), "input": tu.get("input", {})}
                        for tu in tool_uses
                    ]

                if content or tool_uses:
                    turns.append(turn)

            if turns:
                conv_record: dict[str, Any] = {
                    "id": record.get("session_id", str(uuid.uuid4())),
                    "turns": turns,
                }

                metadata = record.get("metadata", {})
                if metadata:
                    conv_record["metadata"] = metadata

                result.append(conv_record)

        return result
