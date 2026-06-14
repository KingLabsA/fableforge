"""Guardrail engine for checking agent outputs against constitutional rules."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Callable

from agent_constitution.rules import ConstitutionalRule, ConstitutionalRules, RuleLevel


@dataclass
class Violation:
    """A single rule violation found in output."""

    rule: ConstitutionalRule
    matched_text: str
    position: int
    suggestion: str

    def __str__(self) -> str:
        return f"[{self.rule.id}] {self.rule.level.value.upper()}: {self.rule.description} — matched: '{self.matched_text[:50]}'"


@dataclass
class GuardrailResult:
    """Result of a guardrail check."""

    passed: bool
    violations: list[Violation] = field(default_factory=list)
    suggestions: list[str] = field(default_factory=list)
    checked_rules: int = 0

    def __str__(self) -> str:
        if self.passed:
            return f"PASS ({self.checked_rules} rules checked, 0 violations)"
        return f"FAIL ({self.checked_rules} rules checked, {len(self.violations)} violations)"


_HARMFUL_PATTERNS = [
    (re.compile(r"(?:how\s+to|ways\s+to|guide\s+to)\s+(?:hack|exploit|attack|steal|break\s+into)", re.IGNORECASE), "This request may involve harmful activities. Refuse and redirect to ethical alternatives.", "MUST-001"),
    (re.compile(r"(?:create|make|build|write)\s+(?:a\s+)?(?:bomb|weapon|malware|virus|trojan|ransomware|keylogger)", re.IGNORECASE), "Cannot assist in creating harmful software or weapons.", "MUST-002"),
    (re.compile(r"(?:bypass|circumvent|evade|disable|turn\s+off)\s+(?:security|authentication|password|firewall|guardrail|guard|safety)", re.IGNORECASE), "Cannot help bypass security measures or guardrails.", "MUST-004"),
    (re.compile(r"(?:ssn|social\s+security\s+number|credit\s+card\s+number|passport\s+number)", re.IGNORECASE), "Do not process or request sensitive personal identifiers.", "MUST-005"),
    (re.compile(r"(?:password|secret|api[_-]?key|token|credential)\s*[:=]\s*\S+", re.IGNORECASE), "Do not include credentials in plain text. Use environment variables or secret managers.", "MUST-006"),
    (re.compile(r"(?:system|assistant|prompt)\s*(?:instructions?|message)" , re.IGNORECASE), "Do not reveal internal system instructions or prompts.", "MUST-007"),
    (re.compile(r"(?:drop\s+table|truncate\s+table?|delete\s+from\s+\w+\s*;?\s*$)", re.IGNORECASE), "Destructive database operations require explicit confirmation and safeguards.", "MUST-012"),
    (re.compile(r"(?:rm\s+-rf|del\s+/[sS]|format\s+[a-zA-Z]:|mkfs|rmdir\s+/[sS])", re.IGNORECASE), "Destructive file system operations require explicit confirmation.", "MUST-011"),
    (re.compile(r"(?:git\s+push\s+--force|git\s+push\s+-f\s+origin\s+main\b)", re.IGNORECASE), "Force-pushing to shared branches is prohibited.", "MAYNOT-004"),
]

_DECEPTION_PATTERNS = [
    (re.compile(r"(?:I\s+am\s+(?:a\s+)?(?:human|real\s+person|not\s+an?\s+AI))", re.IGNORECASE), "Do not pretend to be human. Disclose AI nature truthfully.", "MAYNOT-005"),
]

_EXCESS_PATTERNS = [
    (re.compile(r"(?:I\s+(?:will|need\s+to|should)\s+)?(?:read|check|verify|confirm)\s+(?:the\s+)?(?:same|this|that)\s+(?:file|code|content)\s+(?:again|once\s+more|one\s+more\s+time)", re.IGNORECASE), "Avoid re-reading content you just accessed. Use context from previous reads.", "MAYNOT-012"),
]


class GuardrailEngine:
    """Engine that checks agent outputs against constitutional rules."""

    def __init__(self, rules: ConstitutionalRules | None = None) -> None:
        self.rules = rules or ConstitutionalRules()
        self._custom_checkers: list[Callable[[str], list[Violation]]] = []

    def add_checker(self, checker: Callable[[str], list[Violation]]) -> None:
        """Add a custom checker function."""
        self._custom_checkers.append(checker)

    def check_output(self, output: str, rules: ConstitutionalRules | None = None) -> GuardrailResult:
        """Check output text against constitutional rules.

        Args:
            output: The agent's output text to check.
            rules: Optional override rules. If None, uses engine's rules.

        Returns:
            GuardrailResult with pass/fail status, violations, and suggestions.
        """
        rules_to_use = rules or self.rules
        violations: list[Violation] = []
        suggestions: list[str] = []

        all_pattern_groups = [_HARMFUL_PATTERNS, _DECEPTION_PATTERNS, _EXCESS_PATTERNS]
        for pattern_group in all_pattern_groups:
            for pattern, suggestion, rule_id in pattern_group:
                match = pattern.search(output)
                if match:
                    rule = rules_to_use.get_rule(rule_id)
                    if rule is None:
                        rule = ConstitutionalRule(
                            id=rule_id, category="guardrail", level=RuleLevel.MUST,
                            description=suggestion, enforcement="block",
                        )
                    violations.append(Violation(
                        rule=rule,
                        matched_text=match.group(0),
                        position=match.start(),
                        suggestion=suggestion,
                    ))
                    suggestions.append(suggestion)

        for checker in self._custom_checkers:
            custom_violations = checker(output)
            violations.extend(custom_violations)

        for rule in rules_to_use.get_rules(level=RuleLevel.MUST):
            if rule.id.startswith("MUST-009") and any(v.rule.id == rule.id for v in violations):
                continue
            keywords = rule.description.lower().split()
            important_words = [w for w in keywords if len(w) > 4 and w not in ("without", "never", "should", "always", "before")]
            if important_words:
                matched = sum(1 for w in important_words if w in output.lower())
                if matched >= len(important_words) * 0.7:
                    already_found = any(v.rule.id == rule.id for v in violations)
                    if not already_found:
                        violations.append(Violation(
                            rule=rule,
                            matched_text=output[:100],
                            position=0,
                            suggestion=f"Review against rule: {rule.description}",
                        ))
                        suggestions.append(f"Review against rule: {rule.description}")

        passed = not any(v.rule.enforcement == "block" or v.rule.level == RuleLevel.MUST for v in violations)
        return GuardrailResult(
            passed=passed,
            violations=violations,
            suggestions=suggestions,
            checked_rules=rules_to_use.count(),
        )

    def apply_to_agent(self, agent: Any) -> Any:
        """Wrap an agent with guardrails so all outputs are checked.

        Creates a wrapper that intercepts agent outputs and runs guardrail
        checks before returning results.

        Args:
            agent: An object with a generate() or run() method.

        Returns:
            A GuardrailWrappedAgent that delegates to the original agent
            but checks all outputs.
        """
        return GuardrailWrappedAgent(agent, self)

    def check_prompt(self, prompt: str) -> GuardrailResult:
        """Check a user prompt for injection or manipulation attempts."""
        violations: list[Violation] = []
        suggestions: list[str] = []

        injection_patterns = [
            (re.compile(r"ignore\s+(?:previous|all|your)\s+(?:instructions?|rules?|guidelines?)", re.IGNORECASE), "Potential prompt injection: ignoring instructions.", "MUST-004"),
            (re.compile(r"(?:pretend|act\s+as|roleplay|you\s+are)\s+(?:a\s+)?(?:human|real\s+person|different\s+AI)", re.IGNORECASE), "Deception attempt detected.", "MAYNOT-005"),
            (re.compile(r"(?:forget|disregard|override|skip)\s+(?:everything|all\s+rules|safety)", re.IGNORECASE), "Safety bypass attempt.", "MUST-004"),
            (re.compile(r"(?:reveal|show|print|output)\s+(?:your|the|system)\s+(?:instructions?|prompt|rules?)", re.IGNORECASE), "System prompt extraction attempt.", "MUST-007"),
        ]

        for pattern, suggestion, rule_id in injection_patterns:
            match = pattern.search(prompt)
            if match:
                rule = self.rules.get_rule(rule_id)
                if rule is None:
                    rule = ConstitutionalRule(
                        id=rule_id, category="injection", level=RuleLevel.MUST,
                        description=suggestion, enforcement="block",
                    )
                violations.append(Violation(
                    rule=rule,
                    matched_text=match.group(0),
                    position=match.start(),
                    suggestion=suggestion,
                ))
                suggestions.append(suggestion)

        passed = len(violations) == 0
        return GuardrailResult(
            passed=passed,
            violations=violations,
            suggestions=suggestions,
            checked_rules=self.rules.count(),
        )


class GuardrailWrappedAgent:
    """Agent wrapper that applies guardrails to all outputs."""

    def __init__(self, agent: Any, engine: GuardrailEngine) -> None:
        self._agent = agent
        self._engine = engine
        self._last_result: GuardrailResult | None = None

    @property
    def last_guardrail_result(self) -> GuardrailResult | None:
        return self._last_result

    def generate(self, *args: Any, **kwargs: Any) -> str:
        """Generate output, checking with guardrails after."""
        if hasattr(self._agent, "generate"):
            raw_output = self._agent.generate(*args, **kwargs)
        elif hasattr(self._agent, "run"):
            raw_output = self._agent.run(*args, **kwargs)
        else:
            raise AttributeError("Agent must have a generate() or run() method")

        if isinstance(raw_output, str):
            self._last_result = self._engine.check_output(raw_output)
            if not self._last_result.passed:
                block_violations = [v for v in self._last_result.violations if v.rule.enforcement == "block"]
                if block_violations:
                    return f"[GUARDRAIL BLOCKED] Output blocked by constitutional rules: {', '.join(v.rule.id for v in block_violations)}. Suggestions: {'; '.join(self._last_result.suggestions[:3])}"
            return raw_output
        return raw_output

    def run(self, *args: Any, **kwargs: Any) -> str:
        return self.generate(*args, **kwargs)

    def __getattr__(self, name: str) -> Any:
        return getattr(self._agent, name)
