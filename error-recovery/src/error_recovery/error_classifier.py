"""Classify agent errors into categories for pattern matching."""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from error_recovery.models import ErrorCategory


@dataclass
class ClassificationRule:
    category: ErrorCategory
    patterns: list[str]
    keywords: list[str] = field(default_factory=list)

    def matches(self, error_message: str, tool_name: str = "") -> bool:
        text = f"{tool_name} {error_message}".lower()
        for pat in self.patterns:
            try:
                if re.search(pat, text, re.IGNORECASE | re.DOTALL):
                    return True
            except re.error:
                continue
        for kw in self.keywords:
            pattern = r'\b' + re.escape(kw) + r'\b'
            if re.search(pattern, text, re.IGNORECASE):
                return True
        return False


_CLASSIFICATION_RULES: list[ClassificationRule] = [
    ClassificationRule(
        category=ErrorCategory.BASH_ERROR,
        patterns=[
            r"command not found",
            r"no such file or directory",
            r"permission denied",
            r"exit code \d+",
            r"bash[:\s].*error",
            r"shell[:\s].*error",
            r"subprocess.*failed",
            r"process.*exit.*\d{2,}",
            r"signal\s*\d+",
            r"core dumped",
            r"segmentation fault",
            r"killed\s*$",
            r"oom[- ]killer",
            r"out of memory",
            r"cannot execute",
            r"exec format error",
            r"is not executable",
            r"not a directory",
            r"directory not empty",
            r"device or resource busy",
            r"no space left on device",
            r"read-only file system",
            r"broken pipe",
            r"no child processes",
            r"operation not permitted",
            r"address already in use",
        ],
        keywords=[
            "bash",
            "shell",
            "terminal",
            "command",
            "subprocess",
            "exit code",
            "sudo",
            "chmod",
            "chown",
            "stderr",
            "stdout",
            "syscall",
            "errno",
            "errno",
            "spawn",
            "fork",
        ],
    ),
    ClassificationRule(
        category=ErrorCategory.EDIT_ERROR,
        patterns=[
            r"pattern not (?:found|matched)",
            r"oldstring not found",
            r"replacement failed",
            r"edit.*failed",
            r"could not (?:find|locate).*pattern",
            r"no match.*(?:in|for)",
            r"multiple matches found",
            r"ambiguous match",
            r"line \d+.*not found",
            r"range \d+-\d+.*(?:invalid|out of)",
            r"cannot edit binary file",
            r"file.*unchanged",
            r"no changes made",
        ],
        keywords=[
            "edit",
            "replace",
            "substitute",
            "pattern",
            "match",
            "sed",
            "patch",
            "diff",
            "hunk",
            "oldstring",
            "newstring",
        ],
    ),
    ClassificationRule(
        category=ErrorCategory.READ_ERROR,
        patterns=[
            r"file not found",
            r"cannot read file",
            r"permission denied.*read",
            r"no such file",
            r"unreadable",
            r"unable to open.*read",
            r"is a directory",
            r"text file busy",
        ],
        keywords=[
            "read",
            "open",
            "cat",
            "head",
            "tail",
            "less",
            "more",
            "file not found",
        ],
    ),
    ClassificationRule(
        category=ErrorCategory.WRITE_ERROR,
        patterns=[
            r"permission denied.*write",
            r"disk (?:full|quota)",
            r"no space left",
            r"read-only",
            r"cannot (?:write|create|save)",
            r"unable to write",
            r"file exists",
            r"already exists",
            r"write failed",
            r"save.*failed",
        ],
        keywords=[
            "write",
            "create",
            "save",
            "mkdir",
            "touch",
            "disk full",
            "quota",
        ],
    ),
    ClassificationRule(
        category=ErrorCategory.TEST_ERROR,
        patterns=[
            r"assert(?:ion)? (?:failed|error)",
            r"test.*failed",
            r"expected.*but got",
            r"expected.*actual",
            r"assertionerror",
            r"test.*error",
            r"test.*timeout",
            r"timeout.*test",
            r"flaky",
            r"fixture.*not found",
            r"parametrize",
            r"skip",
            r"xpass",
            r"xfrac{1}{2}",
            r"coverage.*below",
            r"1 failed",
            r"\d+ failed",
        ],
        keywords=[
            "assert",
            "test",
            "pytest",
            "unittest",
            "jest",
            "mocha",
            "vitest",
            "junit",
            "nunit",
            "expect",
            "assertion",
            "fixture",
        ],
    ),
    ClassificationRule(
        category=ErrorCategory.NETWORK_ERROR,
        patterns=[
            r"connection (?:refused|reset|timed? ?out)",
            r"dns.*(?:error|fail|resolve)",
            r"name or service not known",
            r"no route to host",
            r"network.*(?:unreachable|error|down)",
            r"socket.*(?:error|closed|timeout)",
            r"ssl.*(?:error|handshake|certificate)",
            r"tls.*(?:error|handshake)",
            r"curl.*\(\d+\)",
            r"http\s*\d{3}",
            r"request.*(?:failed|timed? ?out)",
            r"proxy.*(?:error|refused)",
            r"econnrefused",
            r"econnreset",
            r"enetunreach",
            r"etimedout",
            r"certificate_verify_failed",
        ],
        keywords=[
            "network",
            "connection",
            "timeout",
            "dns",
            "proxy",
            "ssl",
            "tls",
            "http",
            "socket",
            "request",
            "response",
            "curl",
            "fetch",
            "download",
            "ping",
            "host",
        ],
    ),
    ClassificationRule(
        category=ErrorCategory.IMPORT_ERROR,
        patterns=[
            r"modulenotfounderror",
            r"importerror",
            r"no module named",
            r"cannot import name",
            r"unresolved reference",
            r"package.*not found",
            r"dependency.*(?:missing|not installed|not found)",
            r"requirement.*not satisfied",
            r"pip.*install",
            r"npm.*install",
            r"cargo.*required",
            r"gem.*not found",
            r"not installed",
            r"version.*conflict",
            r"circular import",
        ],
        keywords=[
            "import",
            "module",
            "package",
            "dependency",
            "pip",
            "npm",
            "yarn",
            "cargo",
            "gem",
            "install",
            "requirement",
        ],
    ),
    ClassificationRule(
        category=ErrorCategory.TYPE_ERROR,
        patterns=[
            r"typeerror",
            r"attributeerror",
            r"keyerror",
            r"indexerror",
            r"valueerror",
            r"nonetype.*(?:has no|is not)",
            r"object.*(?:has no attribute|is not subscriptable)",
            r"'(?:none|null|undefined)'.*is not",
            r"cannot.*(?:concat|add|subtract|multiply)",
            r"unsupported operand",
            r"unexpected keyword argument",
            r"missing.*(?:argument|parameter)",
            r"too many.*values to unpack",
            r"not enough values to unpack",
            r"unhashable type",
            r"argument of type",
        ],
        keywords=[
            "typeerror",
            "attributeerror",
            "keyerror",
            "indexerror",
            "valueerror",
            "null",
            "undefined",
            "none",
            "nil",
            "attribute",
            "key",
            "index",
            "type",
        ],
    ),
]


class ErrorClassifier:
    def __init__(
        self,
        rules: list[ClassificationRule] | None = None,
        custom_rules: list[ClassificationRule] | None = None,
    ) -> None:
        self._rules = list(rules) if rules else _CLASSIFICATION_RULES
        if custom_rules:
            self._rules = custom_rules + self._rules

    def classify(self, error_message: str, tool_name: str = "") -> ErrorCategory:
        if not error_message:
            return ErrorCategory.UNKNOWN

        for rule in self._rules:
            if rule.matches(error_message, tool_name):
                return rule.category

        text = f"{tool_name} {error_message}".lower()
        tool_hints: dict[str, ErrorCategory] = {
            "bash": ErrorCategory.BASH_ERROR,
            "shell": ErrorCategory.BASH_ERROR,
            "terminal": ErrorCategory.BASH_ERROR,
            "edit": ErrorCategory.EDIT_ERROR,
            "replace": ErrorCategory.EDIT_ERROR,
            "write": ErrorCategory.WRITE_ERROR,
            "read": ErrorCategory.READ_ERROR,
            "test": ErrorCategory.TEST_ERROR,
            "pytest": ErrorCategory.TEST_ERROR,
            "fetch": ErrorCategory.NETWORK_ERROR,
            "request": ErrorCategory.NETWORK_ERROR,
            "import": ErrorCategory.IMPORT_ERROR,
        }
        for hint, cat in tool_hints.items():
            if hint in text:
                return cat

        return ErrorCategory.UNKNOWN

    def classify_with_confidence(
        self, error_message: str, tool_name: str = ""
    ) -> tuple[ErrorCategory, float]:
        category = self.classify(error_message, tool_name)
        if category == ErrorCategory.UNKNOWN:
            return category, 0.0

        matching_rules = sum(1 for r in self._rules if r.matches(error_message, tool_name))
        confidence = min(0.5 + matching_rules * 0.15, 1.0)
        return category, confidence
