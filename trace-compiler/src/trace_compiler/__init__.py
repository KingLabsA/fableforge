"""TraceCompiler — Compile agent traces into distilled LoRA weights."""

__version__ = "0.1.0"

from trace_compiler.parser import TraceParser, TraceRecord, ToolCall
from trace_compiler.skill_extractor import SkillExtractor, SkillExample, SkillType
from trace_compiler.distiller import Distiller
from trace_compiler.evaluator import Evaluator

__all__ = [
    "TraceParser",
    "TraceRecord",
    "ToolCall",
    "SkillExtractor",
    "SkillExample",
    "SkillType",
    "Distiller",
    "Evaluator",
]