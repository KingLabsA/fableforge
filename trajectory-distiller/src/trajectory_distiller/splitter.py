"""Data splitting for training datasets with stratification."""

from __future__ import annotations

import json
import random
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class TrainValTest:
    """Container for train/validation/test splits."""

    train: list[dict[str, Any]] = field(default_factory=list)
    val: list[dict[str, Any]] = field(default_factory=list)
    test: list[dict[str, Any]] = field(default_factory=list)

    @property
    def total(self) -> int:
        return len(self.train) + len(self.val) + len(self.test)

    def save(self, directory: str | Path, prefix: str = "", format: str = "jsonl") -> None:
        """Save splits to files.

        Args:
            directory: Output directory.
            prefix: File name prefix.
            format: Output format ('jsonl' or 'json').
        """
        directory = Path(directory)
        directory.mkdir(parents=True, exist_ok=True)

        suffix = "jsonl" if format == "jsonl" else "json"

        for split_name, data in [("train", self.train), ("val", self.val), ("test", self.test)]:
            filename = f"{prefix}{split_name}.{suffix}" if prefix else f"{split_name}.{suffix}"
            filepath = directory / filename

            if format == "jsonl":
                with open(filepath, "w") as f:
                    for record in data:
                        f.write(json.dumps(record) + "\n")
            else:
                with open(filepath, "w") as f:
                    json.dump(data, f, indent=2)

    def stats(self) -> dict[str, Any]:
        """Get statistics about the splits."""
        return {
            "train": len(self.train),
            "val": len(self.val),
            "test": len(self.test),
            "total": self.total,
            "train_ratio": len(self.train) / self.total if self.total > 0 else 0,
            "val_ratio": len(self.val) / self.total if self.total > 0 else 0,
            "test_ratio": len(self.test) / self.total if self.total > 0 else 0,
        }


class DataSplitter:
    """Split datasets into train/validation/test with optional stratification."""

    def split(
        self,
        records: list[dict[str, Any]],
        train_ratio: float = 0.95,
        val_ratio: float = 0.05,
        test_ratio: float = 0.0,
        stratify_by: str | None = None,
        seed: int = 42,
    ) -> TrainValTest:
        """Split records into train/validation/test sets.

        Args:
            records: List of normalized records to split.
            train_ratio: Fraction for training set.
            val_ratio: Fraction for validation set.
            test_ratio: Fraction for test set. If 0, calculated from 1 - train - val.
            stratify_by: Key to stratify by. Options: 'tool', 'length', 'quality', None.
            seed: Random seed for reproducibility.

        Returns:
            TrainValTest with split data.
        """
        if test_ratio == 0.0:
            test_ratio = max(0.0, 1.0 - train_ratio - val_ratio)

        total = min(train_ratio + val_ratio + test_ratio, 1.0)
        if total < 1.0:
            scale = 1.0 / total
            train_ratio *= scale
            val_ratio *= scale
            test_ratio *= scale

        if stratify_by is None:
            return self._random_split(records, train_ratio, val_ratio, test_ratio, seed)
        elif stratify_by == "tool":
            return self._stratify_by_tool(records, train_ratio, val_ratio, test_ratio, seed)
        elif stratify_by == "length":
            return self._stratify_by_length(records, train_ratio, val_ratio, test_ratio, seed)
        elif stratify_by == "quality":
            return self._stratify_by_quality(records, train_ratio, val_ratio, test_ratio, seed)
        else:
            return self._random_split(records, train_ratio, val_ratio, test_ratio, seed)

    def _random_split(
        self, records: list[dict[str, Any]],
        train_ratio: float, val_ratio: float, test_ratio: float,
        seed: int,
    ) -> TrainValTest:
        """Simple random split."""
        rng = random.Random(seed)
        shuffled = list(records)
        rng.shuffle(shuffled)

        n = len(shuffled)
        n_train = int(n * train_ratio)
        n_val = int(n * val_ratio)

        return TrainValTest(
            train=shuffled[:n_train],
            val=shuffled[n_train:n_train + n_val],
            test=shuffled[n_train + n_val:],
        )

    def _stratify_by_tool(
        self, records: list[dict[str, Any]],
        train_ratio: float, val_ratio: float, test_ratio: float,
        seed: int,
    ) -> TrainValTest:
        """Stratify by primary tool used in each record."""
        groups: dict[str, list[dict[str, Any]]] = {}
        for record in records:
            primary_tool = self._get_primary_tool(record)
            groups.setdefault(primary_tool, []).append(record)

        train, val, test = [], [], []
        rng = random.Random(seed)

        for tool, group in groups.items():
            shuffled = list(group)
            rng.shuffle(shuffled)
            n = len(shuffled)
            n_train = max(1, int(n * train_ratio))
            n_val = max(min(1, n - n_train), int(n * val_ratio))

            train.extend(shuffled[:n_train])
            val.extend(shuffled[n_train:n_train + n_val])
            test.extend(shuffled[n_train + n_val:])

        rng.shuffle(train)
        rng.shuffle(val)
        rng.shuffle(test)

        return TrainValTest(train=train, val=val, test=test)

    def _stratify_by_length(
        self, records: list[dict[str, Any]],
        train_ratio: float, val_ratio: float, test_ratio: float,
        seed: int,
    ) -> TrainValTest:
        """Stratify by session length (short/medium/long)."""
        groups: dict[str, list[dict[str, Any]]] = {"short": [], "medium": [], "long": []}

        for record in records:
            n_turns = len(record.get("messages", []))
            if n_turns <= 5:
                groups["short"].append(record)
            elif n_turns <= 15:
                groups["medium"].append(record)
            else:
                groups["long"].append(record)

        train, val, test = [], [], []
        rng = random.Random(seed)

        for length, group in groups.items():
            shuffled = list(group)
            rng.shuffle(shuffled)
            n = len(shuffled)
            n_train = max(1, int(n * train_ratio))
            n_val = max(min(1, n - n_train), int(n * val_ratio))

            train.extend(shuffled[:n_train])
            val.extend(shuffled[n_train:n_train + n_val])
            test.extend(shuffled[n_train + n_val:])

        rng.shuffle(train)
        rng.shuffle(val)
        rng.shuffle(test)

        return TrainValTest(train=train, val=val, test=test)

    def _stratify_by_quality(
        self, records: list[dict[str, Any]],
        train_ratio: float, val_ratio: float, test_ratio: float,
        seed: int,
    ) -> TrainValTest:
        """Stratify by quality score (low/medium/high)."""
        from trajectory_distiller.filter import TraceFilter

        filter_ = TraceFilter()
        groups: dict[str, list[dict[str, Any]]] = {"low": [], "medium": [], "high": []}

        for record in records:
            score = filter_._compute_quality_score(record)
            if score < 0.3:
                groups["low"].append(record)
            elif score < 0.6:
                groups["medium"].append(record)
            else:
                groups["high"].append(record)

        train, val, test = [], [], []
        rng = random.Random(seed)

        for quality, group in groups.items():
            shuffled = list(group)
            rng.shuffle(shuffled)
            n = len(shuffled)
            n_train = max(1, int(n * train_ratio))
            n_val = max(min(1, n - n_train), int(n * val_ratio))

            train.extend(shuffled[:n_train])
            val.extend(shuffled[n_train:n_train + n_val])
            test.extend(shuffled[n_train + n_val:])

        rng.shuffle(train)
        rng.shuffle(val)
        rng.shuffle(test)

        return TrainValTest(train=train, val=val, test=test)

    def _get_primary_tool(self, record: dict[str, Any]) -> str:
        """Get the most-used tool in a record."""
        tool_counts: dict[str, int] = {}
        for msg in record.get("messages", []):
            for tu in msg.get("tool_use", []):
                name = tu.get("name", "unknown")
                tool_counts[name] = tool_counts.get(name, 0) + 1

        if tool_counts:
            return max(tool_counts, key=tool_counts.get)  # type: ignore[arg-type]
        return "none"
