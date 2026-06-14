"""Pricing data for LLM models."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ModelPricing:
    """Pricing for a single model."""

    model_id: str
    friendly_name: str
    input_price_per_million: float   # USD per 1M input tokens
    output_price_per_million: float  # USD per 1M output tokens
    context_window: int              # Maximum context length
    tier: str                        # "mini", "standard", "premium", "flagship"

    def calculate_cost(self, input_tokens: int, output_tokens: int) -> float:
        """Calculate total cost for given token counts."""
        input_cost = (input_tokens / 1_000_000) * self.input_price_per_million
        output_cost = (output_tokens / 1_000_000) * self.output_price_per_million
        return input_cost + output_cost


class PricingData:
    """Real pricing data for supported LLM models."""

    MODELS: dict[str, ModelPricing] = {}

    @classmethod
    def _init_models(cls) -> None:
        if cls.MODELS:
            return
        cls.MODELS = {
            "claude-3-5-sonnet-20241022": ModelPricing(
                model_id="claude-3-5-sonnet-20241022",
                friendly_name="Claude 3.5 Sonnet",
                input_price_per_million=3.0,
                output_price_per_million=15.0,
                context_window=200000,
                tier="standard",
            ),
            "claude-3-opus-20240229": ModelPricing(
                model_id="claude-3-opus-20240229",
                friendly_name="Claude 3 Opus",
                input_price_per_million=15.0,
                output_price_per_million=75.0,
                context_window=200000,
                tier="flagship",
            ),
            "claude-3-5-haiku-20241022": ModelPricing(
                model_id="claude-3-5-haiku-20241022",
                friendly_name="Claude 3.5 Haiku",
                input_price_per_million=0.80,
                output_price_per_million=4.0,
                context_window=200000,
                tier="mini",
            ),
            "gpt-4": ModelPricing(
                model_id="gpt-4",
                friendly_name="GPT-4",
                input_price_per_million=30.0,
                output_price_per_million=60.0,
                context_window=8192,
                tier="premium",
            ),
            "gpt-4o": ModelPricing(
                model_id="gpt-4o",
                friendly_name="GPT-4o",
                input_price_per_million=2.5,
                output_price_per_million=10.0,
                context_window=128000,
                tier="standard",
            ),
            "gpt-4o-mini": ModelPricing(
                model_id="gpt-4o-mini",
                friendly_name="GPT-4o Mini",
                input_price_per_million=0.15,
                output_price_per_million=0.60,
                context_window=128000,
                tier="mini",
            ),
            "gpt-4-turbo": ModelPricing(
                model_id="gpt-4-turbo",
                friendly_name="GPT-4 Turbo",
                input_price_per_million=10.0,
                output_price_per_million=30.0,
                context_window=128000,
                tier="premium",
            ),
            "qwen3-coder": ModelPricing(
                model_id="qwen3-coder",
                friendly_name="Qwen3 Coder",
                input_price_per_million=0.50,
                output_price_per_million=1.50,
                context_window=131072,
                tier="mini",
            ),
        }

    @classmethod
    def get_model(cls, model_id: str) -> ModelPricing | None:
        """Get pricing for a specific model."""
        cls._init_models()
        return cls.MODELS.get(model_id)

    @classmethod
    def get_all_models(cls) -> dict[str, ModelPricing]:
        """Get all model pricing data."""
        cls._init_models()
        return dict(cls.MODELS)

    @classmethod
    def get_by_tier(cls, tier: str) -> list[ModelPricing]:
        """Get all models in a specific tier."""
        cls._init_models()
        return [m for m in cls.MODELS.values() if m.tier == tier]

    @classmethod
    def calculate_cost(cls, tokens: int, model: str, output_ratio: float = 0.4) -> float:
        """Calculate cost for a given number of tokens.

        Args:
            tokens: Total tokens (input + output combined).
            model: Model identifier.
            output_ratio: Fraction of tokens that are output tokens.

        Returns:
            Cost in USD.
        """
        cls._init_models()
        pricing = cls.MODELS.get(model)
        if pricing is None:
            raise ValueError(f"Unknown model: {model}. Available: {list(cls.MODELS.keys())}")

        input_tokens = int(tokens * (1 - output_ratio))
        output_tokens = int(tokens * output_ratio)
        return pricing.calculate_cost(input_tokens, output_tokens)

    @classmethod
    def compare_models(cls, tokens: int, models: list[str] | None = None, output_ratio: float = 0.4) -> dict[str, float]:
        """Compare costs across models for the same token count.

        Args:
            tokens: Total tokens.
            models: List of model IDs. Defaults to all models.
            output_ratio: Fraction of tokens that are output tokens.

        Returns:
            Dict mapping model ID to cost in USD.
        """
        cls._init_models()
        if models is None:
            models = list(cls.MODELS.keys())
        result = {}
        for model_id in models:
            result[model_id] = cls.calculate_cost(tokens, model_id, output_ratio)
        return result
