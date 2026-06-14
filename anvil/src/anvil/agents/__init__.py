"""Anvil Agents — multi-agent orchestration for the self-verified coding agent."""

from anvil.agents.agent_base import BaseAgent, AgentMode
from anvil.agents.builtin_agents import (
    BuildAgent,
    PlanAgent,
    ExploreAgent,
    GeneralAgent,
    ScoutAgent,
    CompactionAgent,
    TitleAgent,
    BUILTIN_AGENTS,
)
from anvil.agents.agent_manager import AgentManager

__all__ = [
    "BaseAgent",
    "AgentMode",
    "BuildAgent",
    "PlanAgent",
    "ExploreAgent",
    "GeneralAgent",
    "ScoutAgent",
    "CompactionAgent",
    "TitleAgent",
    "BUILTIN_AGENTS",
    "AgentManager",
]