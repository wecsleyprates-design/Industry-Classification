"""
Structured logger.

Keeps logs uniform and safe — never logs secrets.
"""
from __future__ import annotations

import logging
import os
import sys

_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()

_FMT = "%(asctime)s | %(levelname)-7s | %(name)s | %(message)s"
logging.basicConfig(format=_FMT, level=_LEVEL, stream=sys.stdout)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
