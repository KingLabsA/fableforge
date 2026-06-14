"""Anvil TUI package."""
from anvil.tui.dashboard import AnvilTUI
from anvil.tui.app import RichTUI, run_tui, ChatMessage, MessageRole, FileChange, HAS_TEXTUAL

__all__ = [
    "AnvilTUI",
    "RichTUI",
    "run_tui",
    "ChatMessage",
    "MessageRole",
    "FileChange",
    "HAS_TEXTUAL",
]

if HAS_TEXTUAL:
    from anvil.tui.app import AnvilTUIApp, TUIHeader, StatusBar, AgentBar, MessageArea, InputBar
    __all__.extend(["AnvilTUIApp", "TUIHeader", "StatusBar", "AgentBar", "MessageArea", "InputBar"])