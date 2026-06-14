"""Buggy calculator module — exercise for Anvil's verify-recover loop.

This module contains intentional bugs that the test suite will catch.
Running Anvil against it should detect the failures, diagnose the
root cause, and apply fixes until all tests pass.
"""


def add(a: float, b: float) -> float:
    """Add two numbers. BUG: currently subtracts instead."""
    return a - b  # BUG: should be a + b


def subtract(a: float, b: float) -> float:
    """Subtract b from a. This one is correct."""
    return a - b


def multiply(a: float, b: float) -> float:
    """Multiply two numbers. BUG: currently adds instead."""
    return a + b  # BUG: should be a * b


def divide(a: float, b: float) -> float:
    """Divide a by b. BUG: doesn't handle division by zero."""
    return a / b  # BUG: no ZeroDivisionError handling


def power(base: float, exponent: int) -> float:
    """Raise base to exponent. BUG: uses multiplication instead of **."""
    return base * exponent  # BUG: should be base ** exponent


def modulo(a: float, b: float) -> float:
    """Return a mod b. This one is correct."""
    return a % b


def negate(a: float) -> float:
    """Negate a number. BUG: returns the number unchanged."""
    return a  # BUG: should be -a


def absolute(a: float) -> float:
    """Return absolute value. This one is correct."""
    return abs(a)
