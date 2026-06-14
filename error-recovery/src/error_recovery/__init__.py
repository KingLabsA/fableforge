"""ErrorRecovery-Engine: Self-healing agent middleware."""

from error_recovery.models import ErrorPattern, RecoveryResult, ErrorRecoveryConfig
from error_recovery.error_classifier import ErrorClassifier, ErrorCategory
from error_recovery.pattern_matcher import PatternMatcher
from error_recovery.recovery_engine import ErrorRecoveryEngine
from error_recovery.middleware import ErrorRecoveryMiddleware

__version__ = "0.1.0"
__all__ = [
    "ErrorPattern",
    "RecoveryResult",
    "ErrorRecoveryConfig",
    "ErrorClassifier",
    "ErrorCategory",
    "PatternMatcher",
    "ErrorRecoveryEngine",
    "ErrorRecoveryMiddleware",
]
