"""Trajectory Distiller - Convert agent traces to training datasets."""

from trajectory_distiller.distiller import Distiller
from trajectory_distiller.converter import FormatConverter
from trajectory_distiller.filter import TraceFilter
from trajectory_distiller.splitter import DataSplitter

__all__ = [
    "Distiller",
    "FormatConverter",
    "TraceFilter",
    "DataSplitter",
]
__version__ = "0.1.0"
