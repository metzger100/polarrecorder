#!/usr/bin/env python3
"""Cross-file duplicate-function detector for server/polarrecorder/.

AI agents reliably re-implement a helper instead of importing the canonical
one (CLAUDE.md Section 8, "Before creating any helper"). ruff cannot see
cross-file clones; this checker does.

Each function/method body is reduced to a structural fingerprint: local
identifier names are normalised away (so variable-renamed copies still match)
while attribute names, called functions, operators, control flow and literal
constants are preserved (so unrelated same-shape functions do not collide).
Two functions in different files that share a fingerprint and exceed the node
threshold are flagged as duplicates; the fix is to extract or import one
canonical helper.

Run from the repo root (or set POLARRECORDER_CHECK_ROOT). Exit 0 when clean,
1 when duplicates are found.
"""

from __future__ import annotations

import ast
import os
import sys
from pathlib import Path

ROOT = Path(os.environ.get("POLARRECORDER_CHECK_ROOT", Path(__file__).resolve().parent.parent))
SCAN_ROOT = ROOT / "server" / "polarrecorder"

# A fingerprint must span at least this many AST nodes to count as a clone.
# Small accessors, Protocol stubs and one-line wrappers stay below it and are
# never flagged.
MIN_FINGERPRINT_NODES = 28
MIN_BLOCK_NODES = 80
MIN_BLOCK_STATEMENTS = 6


class _Function:
    """A scanned function with its location and structural fingerprint."""

    def __init__(self, rel: str, node: ast.FunctionDef | ast.AsyncFunctionDef) -> None:
        """Record the function's qualified name, line and fingerprint."""
        self.rel = rel
        self.name = node.name
        self.lineno = node.lineno
        tokens = _fingerprint_body(node)
        self.size = len(tokens)
        self.fingerprint = "\x1f".join(tokens)
        self.blocks = _fingerprint_blocks(node)


def main() -> int:
    """Scan domain modules and report cross-file duplicate functions.

    Returns:
        Process exit code: 0 when clean, 1 when duplicates are found.
    """
    functions = [fn for path in sorted(SCAN_ROOT.rglob("*.py")) for fn in _scan_file(path)]
    by_fingerprint: dict[str, list[_Function]] = {}
    for fn in functions:
        if fn.size >= MIN_FINGERPRINT_NODES:
            by_fingerprint.setdefault(fn.fingerprint, []).append(fn)

    failures: list[str] = []
    for group in by_fingerprint.values():
        files = {fn.rel for fn in group}
        if len(files) < 2:
            continue
        locations = ", ".join(f"{fn.rel}:{fn.lineno} ({fn.name})" for fn in group)
        failures.append(
            f"duplicate function body across files: {locations}; "
            f"extract one canonical helper and import it"
        )
    failures.extend(_duplicate_block_failures(functions))

    if failures:
        for failure in sorted(failures):
            sys.stderr.write(f"[duplication] {failure}\n")
        sys.stderr.write(f"[duplication] {len(failures)} duplicate group(s) found.\n")
        return 1
    sys.stdout.write("Duplication check passed.\n")
    return 0


def _scan_file(path: Path) -> list[_Function]:
    """Return all functions defined in a module."""
    rel = path.relative_to(ROOT).as_posix()
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    return [
        _Function(rel, node)
        for node in ast.walk(tree)
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
    ]


def _fingerprint_body(node: ast.FunctionDef | ast.AsyncFunctionDef) -> list[str]:
    """Return structural tokens for a function body (docstring stripped)."""
    body = node.body
    if body and isinstance(body[0], ast.Expr) and isinstance(body[0].value, ast.Constant):
        body = body[1:]
    tokens: list[str] = []
    for stmt in body:
        _emit(stmt, tokens)
    return tokens


def _fingerprint_blocks(node: ast.FunctionDef | ast.AsyncFunctionDef) -> list[tuple[int, int, str]]:
    """Return structural fingerprints for long same-function statement blocks."""
    body = node.body
    if body and isinstance(body[0], ast.Expr) and isinstance(body[0].value, ast.Constant):
        body = body[1:]
    if len(body) < MIN_BLOCK_STATEMENTS:
        return []
    by_statement: list[tuple[int, list[str]]] = []
    for stmt in body:
        tokens: list[str] = []
        _emit(stmt, tokens)
        by_statement.append((stmt.lineno, tokens))

    blocks: list[tuple[int, int, str]] = []
    for index in range(0, len(by_statement) - MIN_BLOCK_STATEMENTS + 1):
        selected = by_statement[index : index + MIN_BLOCK_STATEMENTS]
        tokens = [token for _line, stmt_tokens in selected for token in stmt_tokens]
        if len(tokens) >= MIN_BLOCK_NODES:
            blocks.append((selected[0][0], len(tokens), "\x1f".join(tokens)))
    return blocks


def _duplicate_block_failures(functions: list[_Function]) -> list[str]:
    """Return findings for duplicated long statement blocks across files."""
    by_fingerprint: dict[str, list[tuple[_Function, int, int]]] = {}
    for fn in functions:
        for line, size, fingerprint in fn.blocks:
            by_fingerprint.setdefault(fingerprint, []).append((fn, line, size))

    failures: list[str] = []
    seen: set[str] = set()
    for group in by_fingerprint.values():
        files = {fn.rel for fn, _line, _size in group}
        if len(files) < 2:
            continue
        locations = ", ".join(f"{fn.rel}:{line} ({fn.name})" for fn, line, _size in group)
        key = "|".join(sorted(f"{fn.rel}:{line}:{fn.name}" for fn, line, _size in group))
        if key in seen:
            continue
        seen.add(key)
        size = max(size for _fn, _line, size in group)
        failures.append(
            f"duplicate function block across files: {locations} "
            f"({size} AST nodes); extract one canonical helper and import it"
        )
    return sorted(failures)


def _emit(node: ast.AST, tokens: list[str]) -> None:
    """Append normalised structural tokens for node and its children."""
    if isinstance(node, ast.Name):
        tokens.append("Name")  # local identifiers are normalised away
    elif isinstance(node, ast.arg):
        tokens.append("arg")
    elif isinstance(node, ast.Attribute):
        tokens.append(f"Attribute:{node.attr}")
    elif isinstance(node, ast.Constant):
        tokens.append(f"Const:{node.value!r}")
    elif isinstance(node, ast.keyword):
        tokens.append(f"kw:{node.arg}")
    else:
        tokens.append(type(node).__name__)
    for child in ast.iter_child_nodes(node):
        _emit(child, tokens)


if __name__ == "__main__":
    raise SystemExit(main())
