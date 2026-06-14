"""Model routing based on task complexity."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from cost_optimizer.pricing import PricingData, ModelPricing


@dataclass
class TaskAssessment:
    """Assessment of a task's complexity for model routing."""

    task_description: str
    complexity_score: float  # 0.0 (trivial) to 1.0 (highly complex)
    recommended_model: str
    reasoning: str
    estimated_savings_pct: float = 0.0


_COMPLEXITY_INDICATORS: dict[str, tuple[float, str]] = {
    "simple": (0.2, "straightforward task with clear inputs and outputs"),
    "trivial": (0.1, "minimal reasoning required"),
    "basic": (0.2, "simple lookup or formatting task"),
    "lookup": (0.15, "information retrieval or formatting"),
    "formatting": (0.15, "text formatting or restructuring"),
    "translation": (0.2, "language translation task"),
    "summarization": (0.25, "text summarization"),
    "summary": (0.25, "creating a summary"),
    "moderate": (0.5, "requires some reasoning and domain knowledge"),
    "explanation": (0.4, "explaining concepts or code"),
    "refactoring": (0.5, "code refactoring with clear specifications"),
    "bug_fix": (0.55, "debugging with error messages provided"),
    "feature": (0.6, "implementing a well-specified feature"),
    "complex": (0.8, "requires deep reasoning, multiple steps, or expertise"),
    "architecture": (0.85, "system design or architecture decisions"),
    "security": (0.85, "security-sensitive implementation"),
    "debugging": (0.7, "debugging without clear error messages"),
    "reasoning": (0.8, "multi-step logical reasoning"),
    "planning": (0.75, "strategic planning or decision-making"),
    "creative": (0.7, "creative generation requiring originality"),
    "research": (0.75, "research and synthesis of information"),
    "critical": (0.95, "high-stakes decision or safety-critical code"),
    "safety": (0.95, "safety-critical evaluation"),
}


class ModelRouter:
    """Route tasks to appropriate models based on complexity assessment."""

    TIER_COMPLEXITY_MAP = {
        "mini": (0.0, 0.35),
        "standard": (0.35, 0.65),
        "premium": (0.65, 0.85),
        "flagship": (0.85, 1.0),
    }

    def __init__(self) -> None:
        self._pricing = PricingData()

    def route(self, task_complexity: float | str | dict[str, Any]) -> str:
        """Route a task to the most cost-effective model.

        Args:
            task_complexity: Either a float 0-1, a description string,
                           or a dict with task metadata.

        Returns:
            Model ID string for the recommended model.
        """
        if isinstance(task_complexity, float):
            score = task_complexity
            reasoning = f"Explicit complexity score: {score:.2f}"
        elif isinstance(task_complexity, str):
            score, reasoning = self._score_from_description(task_complexity)
        elif isinstance(task_complexity, dict):
            score, reasoning = self._score_from_metadata(task_complexity)
        else:
            score = 0.5
            reasoning = "Default: unknown task type"

        model = self._select_model(score)
        return model

    def assess(self, task_description: str) -> TaskAssessment:
        """Full assessment of a task with routing recommendation.

        Args:
            task_description: Natural language description of the task.

        Returns:
            TaskAssessment with complexity score and model recommendation.
        """
        score, reasoning = self._score_from_description(task_description)
        recommended_model = self._select_model(score)

        default_model = self._pricing.get_model("claude-3-5-sonnet-20241022")
        cheap_model = self._pricing.get_model(recommended_model)

        savings_pct = 0.0
        if default_model and cheap_model and score < 0.65:
            default_cost = default_model.calculate_cost(1000, 500)
            cheap_cost = cheap_model.calculate_cost(1000, 500)
            if default_cost > 0:
                savings_pct = (1 - cheap_cost / default_cost) * 100

        return TaskAssessment(
            task_description=task_description,
            complexity_score=score,
            recommended_model=recommended_model,
            reasoning=reasoning,
            estimated_savings_pct=savings_pct,
        )

    def _score_from_description(self, description: str) -> tuple[float, str]:
        """Calculate complexity score from a task description."""
        desc_lower = description.lower()
        best_score = 0.5
        best_reason = "Default moderate complexity"

        for keyword, (score, reason) in _COMPLEXITY_INDICATORS.items():
            if keyword in desc_lower:
                if score > best_score or best_score == 0.5:
                    best_score = score
                    best_reason = f"Matched keyword '{keyword}': {reason}"

        word_count = len(description.split())
        if word_count > 100:
            best_score = min(best_score + 0.1, 1.0)
            best_reason += " (boosted for long description)"

        question_marks = description.count("?")
        if question_marks > 2:
            best_score = min(best_score + 0.05, 1.0)
            best_reason += " (boosted for multi-question)"

        return best_score, best_reason

    def _score_from_metadata(self, metadata: dict[str, Any]) -> tuple[float, str]:
        """Calculate complexity score from task metadata."""
        score = 0.5
        reasons = []

        if "has_code" in metadata and metadata["has_code"]:
            score += 0.1
            reasons.append("involves code")

        if "has_errors" in metadata and metadata["has_errors"]:
            score += 0.15
            reasons.append("has errors to debug")

        if "multi_step" in metadata and metadata["multi_step"]:
            score += 0.1
            reasons.append("multi-step")

        if "safety_critical" in metadata and metadata["safety_critical"]:
            score = max(score, 0.9)
            reasons.append("safety-critical")

        if "simple" in metadata and metadata["simple"]:
            score = min(score, 0.2)
            reasons.append("marked as simple")

        if "tools_needed" in metadata:
            num_tools = metadata["tools_needed"]
            if isinstance(num_tools, int):
                if num_tools > 5:
                    score += 0.15
                elif num_tools > 2:
                    score += 0.05

        score = max(0.0, min(1.0, score))
        reasoning = "; ".join(reasons) if reasons else "Default moderate complexity"
        return score, reasoning

    def _select_model(self, complexity_score: float) -> str:
        """Select the cheapest model that can handle the given complexity."""
        models = self._pricing.get_all_models()
        tier_models: dict[str, list[ModelPricing]] = {}
        for m in models.values():
            tier_models.setdefault(m.tier, []).append(m)

        for tier, (low, high) in self.TIER_COMPLEXITY_MAP.items():
            if low <= complexity_score <= high:
                tier_models_list = tier_models.get(tier, [])
                if tier_models_list:
                    tier_models_list.sort(key=lambda m: m.input_price_per_million)
                    return tier_models_list[0].model_id

        if complexity_score > 0.85:
            flagship_models = tier_models.get("flagship", [])
            if flagship_models:
                return flagship_models[0].model_id

        all_models = list(models.values())
        all_models.sort(key=lambda m: m.input_price_per_million)
        return all_models[0].model_id
