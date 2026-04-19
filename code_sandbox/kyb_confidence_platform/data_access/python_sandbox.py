"""
Sandboxed Python runner.

- Whitelist of importable modules (pandas, numpy, math, json, statistics, datetime, re)
- No filesystem, no network
- CPU time limit (best-effort, POSIX)
- Captures last expression value & stdout
"""
from __future__ import annotations

import io
import contextlib
import os
import signal
import sys
from dataclasses import dataclass


ALLOWED_MODULES = {
    "pandas", "numpy", "math", "json", "statistics", "datetime", "re",
    "collections", "itertools", "functools", "decimal",
}


@dataclass
class PySandboxResult:
    stdout: str
    value: object
    error: str | None
    truncated: bool


class _SandboxImporter:
    def find_module(self, name: str, path=None):  # type: ignore[override]
        root = name.split(".")[0]
        if root not in ALLOWED_MODULES:
            raise ImportError(f"Module '{name}' is not allowed in the sandbox")
        return None


class _TimeoutError(Exception):
    pass


def _alarm(_sig, _frame):  # pragma: no cover
    raise _TimeoutError("Python sandbox CPU time limit exceeded")


def run(code: str, timeout_s: int = 15) -> PySandboxResult:
    """Execute `code` in a restricted namespace and return captured output."""
    # Safe builtins
    safe_builtins = {
        "abs": abs, "all": all, "any": any, "bool": bool, "dict": dict,
        "enumerate": enumerate, "filter": filter, "float": float, "int": int,
        "len": len, "list": list, "map": map, "max": max, "min": min,
        "print": print, "range": range, "reversed": reversed, "round": round,
        "set": set, "sorted": sorted, "str": str, "sum": sum, "tuple": tuple,
        "zip": zip, "type": type, "isinstance": isinstance, "hasattr": hasattr,
        "getattr": getattr, "iter": iter, "next": next, "repr": repr,
        "__import__": _sandboxed_import,
    }

    ns: dict = {"__builtins__": safe_builtins}

    buf = io.StringIO()
    last_val: object = None
    err: str | None = None
    truncated = False

    # Set alarm (POSIX only)
    old_handler = None
    if hasattr(signal, "SIGALRM") and os.name != "nt":
        old_handler = signal.signal(signal.SIGALRM, _alarm)
        signal.alarm(int(timeout_s))

    try:
        with contextlib.redirect_stdout(buf):
            # Detect last-expression pattern to capture its value Jupyter-style
            import ast
            try:
                tree = ast.parse(code, mode="exec")
            except SyntaxError as e:
                err = f"SyntaxError: {e}"
                return PySandboxResult(stdout="", value=None, error=err, truncated=False)
            if tree.body and isinstance(tree.body[-1], ast.Expr):
                last = tree.body.pop()
                exec(compile(tree, "<sandbox>", "exec"), ns)  # noqa: S102
                last_val = eval(compile(ast.Expression(last.value), "<sandbox>", "eval"), ns)  # noqa: S307
            else:
                exec(compile(tree, "<sandbox>", "exec"), ns)  # noqa: S102
    except _TimeoutError as e:
        err = str(e)
    except Exception as exc:  # pragma: no cover
        err = f"{type(exc).__name__}: {exc}"
    finally:
        if hasattr(signal, "SIGALRM") and os.name != "nt":
            signal.alarm(0)
            if old_handler is not None:
                signal.signal(signal.SIGALRM, old_handler)

    output = buf.getvalue()
    if len(output) > 20000:
        output = output[:20000] + "\n... (truncated)"
        truncated = True
    return PySandboxResult(stdout=output, value=last_val, error=err, truncated=truncated)


def _sandboxed_import(name: str, globals=None, locals=None, fromlist=(), level=0):
    root = name.split(".")[0]
    if root not in ALLOWED_MODULES:
        raise ImportError(f"Module '{name}' is not allowed in the sandbox")
    return __import__(name, globals, locals, fromlist, level)
