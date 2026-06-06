#!/usr/bin/env python3
"""Fail-closed contract checker for server/polarrecorder/ domain code.

Mechanically enforces the AI-agent anti-patterns documented in CLAUDE.md
Section 8 that ruff/mypy cannot see:

- truthy-fallback   : ``<expr> or <literal-default>`` clobbers a legitimate
                      falsy value ("", 0, 0.0, False, [], {}). The producer's
                      contract guarantees the value; mask nothing.
- getattr-fallback  : ``getattr(obj, "field", <default>)`` with a literal
                      attribute name papers over a guaranteed attribute.
                      Access ``obj.field`` directly.
- nan-sentinel      : ``float("nan"|"inf"|"-inf")`` / ``math.nan`` /
                      ``math.inf`` used as an absent-value sentinel. Use
                      ``None``.
- redundant-type-guard : ``x if isinstance(x, list) else []`` or
                      ``str(x if x is None else "")`` re-sanitizes a value the
                      producer already validated. Trust the contract. This is
                      the Python twin of the viewer ``redundant-null-type-guard``
                      rule, which previously had no domain-code equivalent.
- framework-method-guard : ``hasattr(self, "field")`` / ``callable(getattr(self,
                      "field", ...))`` defensively probe an attribute or method
                      that the class contract guarantees. Access it directly.
                      Python twin of the viewer ``framework-method-typeof-guard``.
- premature-legacy-support : a module/class-level ``def`` or constant whose name
                      contains ``legacy``/``compat``/``deprecated`` and is never
                      referenced anywhere in the package is a speculative compat
                      path. Remove it until a live boundary requires it. Names
                      that ARE referenced (active boundary contracts such as
                      ``LEGACY_PRESET_ALIASES``) are left alone. Python twin of
                      the viewer ``premature-legacy-support`` rule.
- canonical-helper-redefinition : a module-level ``def`` re-implements a
                      canonical domain helper owned by another module. Import
                      the canonical helper instead of forking the contract.
                      This catches a divergent re-implementation under the
                      same name that body-based duplication detection misses.
- canonical-helper-map-stale : the ``_CANONICAL_HELPERS`` owner map points at a
                      module/name that no longer defines that helper (renamed,
                      moved, or deleted). A stale map silently stops guarding the
                      helper, so an agent could re-implement it freely. Verifying
                      the map closes that gap (the static twin of the
                      dyninstruments ``canonical-helper-completeness`` runtime
                      check).

Scope is server/polarrecorder/ only: that is where producer contracts are
guaranteed. plugin.py (AvNav boundary) and tests/ legitimately use defensive
fallbacks and are not scanned (plugin.py is read for reference-tracking only).

Run from the repo root (or set POLARRECORDER_CHECK_ROOT). Exit 0 when clean,
1 when any violation is found.
"""

from __future__ import annotations

import ast
import os
import sys
from pathlib import Path

ROOT = Path(os.environ.get("POLARRECORDER_CHECK_ROOT", Path(__file__).resolve().parent.parent))
SCAN_ROOT = ROOT / "server" / "polarrecorder"

# math attributes that are absent-value sentinels when used as a value.
_MATH_SENTINEL_ATTRS = frozenset({"nan", "inf"})

# Strings that turn ``float(...)`` into a non-finite sentinel.
_FLOAT_SENTINEL_STRINGS = frozenset({"nan", "inf", "-inf", "+inf", "infinity", "-infinity"})

# Name fragments that mark a declaration as a legacy/compat shim.
_LEGACY_TOKENS = ("legacy", "compat", "deprecated")

# Canonical domain helpers mapped to their single owning module (repo-relative,
# posix). Re-implementing one of these under the same name in another module
# forks the contract even when the body diverges enough to dodge cross-file
# duplication detection. Import the canonical helper instead. Only generic,
# clearly-shared helpers are listed; each is verified to have exactly one owner.
_CANONICAL_HELPERS = {
    "meters_per_second_to_knots": "server/polarrecorder/units.py",
    "knots_to_meters_per_second": "server/polarrecorder/units.py",
    "twa_bin": "server/polarrecorder/bins.py",
    "tws_bin": "server/polarrecorder/bins.py",
    "bin_address": "server/polarrecorder/bins.py",
    "speed_key": "server/polarrecorder/histogram.py",
    "add_sample": "server/polarrecorder/histogram.py",
    "merge_histograms": "server/polarrecorder/histogram.py",
    "circular_distance": "server/polarrecorder/validation/angle_math.py",
    "circular_range": "server/polarrecorder/validation/angle_math.py",
    "project_grid": "server/polarrecorder/projection.py",
    "anchor_origin": "server/polarrecorder/projection.py",
}


def main() -> int:
    """Scan domain modules and report contract violations.

    Returns:
        Process exit code: 0 when clean, 1 when violations are found.
    """
    parsed: list[tuple[str, ast.Module]] = []
    for path in sorted(SCAN_ROOT.rglob("*.py")):
        rel = path.relative_to(ROOT).as_posix()
        parsed.append((rel, ast.parse(path.read_text(encoding="utf-8"), filename=str(path))))

    referenced = _collect_referenced_names([tree for _rel, tree in parsed] + _boundary_trees())

    failures: list[str] = []
    for rel, tree in parsed:
        failures.extend(_check_canonical_helpers(tree, rel))
        failures.extend(_check_speculative_legacy(tree, rel, referenced))
        for node in ast.walk(tree):
            failures.extend(_check_node(node, rel))
    failures.extend(validate_canonical_helper_map())

    if failures:
        for failure in failures:
            sys.stderr.write(f"[contracts] {failure}\n")
        sys.stderr.write(f"[contracts] {len(failures)} violation(s) found.\n")
        return 1
    sys.stdout.write("Contract check passed.\n")
    return 0


def _boundary_trees() -> list[ast.Module]:
    """Parse plugin.py (if present) so boundary references count as usages.

    A domain symbol consumed only by the AvNav boundary must not be flagged as
    an unreferenced speculative shim.
    """
    plugin = ROOT / "plugin.py"
    if not plugin.exists():
        return []
    return [ast.parse(plugin.read_text(encoding="utf-8"), filename=str(plugin))]


def _collect_referenced_names(trees: list[ast.Module]) -> set[str]:
    """Return every identifier loaded or accessed across the given trees."""
    referenced: set[str] = set()
    for tree in trees:
        for node in ast.walk(tree):
            if isinstance(node, ast.Name) and isinstance(node.ctx, ast.Load):
                referenced.add(node.id)
            elif isinstance(node, ast.Attribute):
                referenced.add(node.attr)
    return referenced


def validate_canonical_helper_map(
    helpers: dict[str, str] | None = None,
    root: Path | None = None,
) -> list[str]:
    """Verify every canonical-helper owner still defines its helper.

    Independent of the scan ``ROOT`` so the per-file scan can be redirected at a
    fixture while map validation still targets the real repository.

    Args:
        helpers: Helper-name to owner-module map; defaults to the curated map.
        root: Repository root holding the owner modules; defaults to the repo
            the checker lives in.

    Returns:
        One ``canonical-helper-map-stale`` finding per owner that no longer
        defines its mapped helper.
    """
    helpers = _CANONICAL_HELPERS if helpers is None else helpers
    base = root if root is not None else Path(
        os.environ.get("POLARRECORDER_CHECK_ROOT", Path(__file__).resolve().parent.parent)
    )
    findings: list[str] = []
    for name, owner in sorted(helpers.items()):
        owner_path = base / owner
        if not owner_path.exists():
            findings.append(
                f"{owner}: canonical-helper-map-stale: owner module for '{name}' "
                f"is missing; update the _CANONICAL_HELPERS map in check-py-contracts.py"
            )
            continue
        tree = ast.parse(owner_path.read_text(encoding="utf-8"), filename=str(owner_path))
        defined = {
            node.name
            for node in tree.body
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
        }
        if name not in defined:
            findings.append(
                f"{owner}: canonical-helper-map-stale: '{name}' is mapped here but "
                f"no module-level def of that name exists; restore the helper or "
                f"fix the _CANONICAL_HELPERS map in check-py-contracts.py"
            )
    return findings


def _check_canonical_helpers(tree: ast.Module, rel: str) -> list[str]:
    """Flag module-level defs that re-implement a canonical helper by name."""
    findings: list[str] = []
    for node in tree.body:
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        owner = _CANONICAL_HELPERS.get(node.name)
        if owner is None or owner == rel:
            continue
        findings.append(
            f"{rel}:{node.lineno}: canonical-helper-redefinition: "
            f"'{node.name}' is a canonical helper owned by {owner}; "
            f"import it instead of re-implementing it"
        )
    return findings


def _check_speculative_legacy(tree: ast.Module, rel: str, referenced: set[str]) -> list[str]:
    """Flag unreferenced legacy/compat/deprecated declarations as speculative."""
    findings: list[str] = []
    for name, lineno in _declaration_names(tree):
        lowered = name.lower()
        if not any(token in lowered for token in _LEGACY_TOKENS):
            continue
        if name in referenced:
            continue
        findings.append(
            f"{rel}:{lineno}: premature-legacy-support: "
            f"'{name}' is a speculative legacy/compat path that nothing references; "
            f"remove it until a live boundary contract requires it"
        )
    return findings


def _declaration_names(tree: ast.Module) -> list[tuple[str, int]]:
    """Return module- and class-level declared names with their line numbers."""
    declarations: list[tuple[str, int]] = []
    bodies: list[list[ast.stmt]] = [tree.body]
    while bodies:
        body = bodies.pop()
        for node in body:
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                declarations.append((node.name, node.lineno))
            elif isinstance(node, ast.ClassDef):
                declarations.append((node.name, node.lineno))
                bodies.append(node.body)
            elif isinstance(node, ast.Assign):
                declarations.extend(
                    (target.id, target.lineno)
                    for target in node.targets
                    if isinstance(target, ast.Name)
                )
            elif isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
                declarations.append((node.target.id, node.target.lineno))
    return declarations


def _check_node(node: ast.AST, rel: str) -> list[str]:
    """Return violations contributed by a single AST node."""
    if isinstance(node, ast.BoolOp):
        return _check_or_fallback(node, rel)
    if isinstance(node, ast.Call):
        return (
            _check_getattr_fallback(node, rel)
            + _check_float_sentinel(node, rel)
            + _check_framework_method_guard(node, rel)
            + _check_redundant_str_guard(node, rel)
        )
    if isinstance(node, ast.IfExp):
        return _check_redundant_type_guard(node, rel)
    if isinstance(node, ast.Attribute):
        return _check_math_sentinel(node, rel)
    return []


def _check_or_fallback(node: ast.BoolOp, rel: str) -> list[str]:
    """Flag ``<expr> or <falsy-literal>`` masking defaults."""
    if not isinstance(node.op, ast.Or):
        return []
    findings: list[str] = []
    # Only the trailing operand acts as the fallback value.
    last = node.values[-1]
    if _is_falsy_masking_literal(last):
        findings.append(
            f"{rel}:{node.lineno}: truthy-fallback: "
            f"'or {ast.unparse(last)}' clobbers a falsy producer value; "
            f"the contract guarantees the value, so do not mask it"
        )
    return findings


def _check_getattr_fallback(node: ast.Call, rel: str) -> list[str]:
    """Flag ``getattr(obj, "literal", default)`` with a 3rd default arg."""
    if not (isinstance(node.func, ast.Name) and node.func.id == "getattr"):
        return []
    if len(node.args) < 3:
        return []
    attr = node.args[1]
    if isinstance(attr, ast.Constant) and isinstance(attr.value, str):
        return [
            f"{rel}:{node.lineno}: getattr-fallback: "
            f"getattr(..., {attr.value!r}, <default>) masks a guaranteed "
            f"attribute; access it directly and fail loudly if absent"
        ]
    return []


def _check_float_sentinel(node: ast.Call, rel: str) -> list[str]:
    """Flag ``float("nan"|"inf"|...)`` used as a sentinel value."""
    if not (isinstance(node.func, ast.Name) and node.func.id == "float"):
        return []
    if len(node.args) != 1:
        return []
    arg = node.args[0]
    if isinstance(arg, ast.Constant) and isinstance(arg.value, str):
        if arg.value.strip().lower() in _FLOAT_SENTINEL_STRINGS:
            return [
                f"{rel}:{node.lineno}: nan-sentinel: "
                f"float({arg.value!r}) is an absent-value sentinel; use None"
            ]
    return []


def _check_framework_method_guard(node: ast.Call, rel: str) -> list[str]:
    """Flag ``hasattr(self, "x")`` / ``callable(getattr(self, "x", ...))`` guards."""
    if not isinstance(node.func, ast.Name):
        return []
    if node.func.id == "hasattr" and len(node.args) == 2:
        obj, attr = node.args
        if _is_self(obj) and isinstance(attr, ast.Constant) and isinstance(attr.value, str):
            return [
                f"{rel}:{node.lineno}: framework-method-guard: "
                f"hasattr(self, {attr.value!r}) probes a guaranteed attribute; "
                f"access self.{attr.value} directly and fail loudly if the contract is unmet"
            ]
    if node.func.id == "callable" and len(node.args) == 1:
        inner = node.args[0]
        if (
            isinstance(inner, ast.Call)
            and isinstance(inner.func, ast.Name)
            and inner.func.id == "getattr"
            and inner.args
            and _is_self(inner.args[0])
        ):
            return [
                f"{rel}:{node.lineno}: framework-method-guard: "
                f"callable(getattr(self, ...)) probes a guaranteed method; "
                f"call it directly and trust the class contract"
            ]
    return []


def _check_redundant_str_guard(node: ast.Call, rel: str) -> list[str]:
    """Flag ``str(<x> if <y> is [not] None else <z>)`` re-sanitizing a value."""
    if not (isinstance(node.func, ast.Name) and node.func.id == "str"):
        return []
    if len(node.args) != 1 or not isinstance(node.args[0], ast.IfExp):
        return []
    test = node.args[0].test
    if not isinstance(test, ast.Compare):
        return []
    is_none_test = any(isinstance(op, (ast.Is, ast.IsNot)) for op in test.ops) and any(
        isinstance(value, ast.Constant) and value.value is None for value in test.comparators
    )
    if is_none_test:
        return [
            f"{rel}:{node.lineno}: redundant-type-guard: "
            f"'str(... if ... is None else ...)' re-sanitizes a producer-guaranteed "
            f"value; trust the validated contract and stringify directly"
        ]
    return []


def _check_redundant_type_guard(node: ast.IfExp, rel: str) -> list[str]:
    """Flag ``x if isinstance(x, list) else []`` re-sanitizing a value."""
    test = node.test
    if not (
        isinstance(test, ast.Call)
        and isinstance(test.func, ast.Name)
        and test.func.id == "isinstance"
    ):
        return []
    if _is_empty_container(node.orelse) or _is_empty_container(node.body):
        return [
            f"{rel}:{node.lineno}: redundant-type-guard: "
            f"'isinstance(...) ? value : <empty>' re-sanitizes a producer-guaranteed "
            f"value; trust the validated contract instead of re-checking its type"
        ]
    return []


def _check_math_sentinel(node: ast.Attribute, rel: str) -> list[str]:
    """Flag ``math.nan`` / ``math.inf`` used as a sentinel value."""
    if isinstance(node.value, ast.Name) and node.value.id == "math":
        if node.attr in _MATH_SENTINEL_ATTRS:
            return [
                f"{rel}:{node.lineno}: nan-sentinel: "
                f"'math.{node.attr}' is an absent-value sentinel; use None"
            ]
    return []


def _is_self(node: ast.expr) -> bool:
    """Return True when node is the ``self`` parameter name."""
    return isinstance(node, ast.Name) and node.id == "self"


def _is_empty_container(node: ast.expr) -> bool:
    """Return True for an empty ``[]``, ``()``, ``{}`` or empty set literal."""
    if isinstance(node, (ast.List, ast.Tuple, ast.Set)):
        return len(node.elts) == 0
    if isinstance(node, ast.Dict):
        return len(node.keys) == 0
    return False


def _is_falsy_masking_literal(node: ast.expr) -> bool:
    """Return True when node is a falsy literal that masks a producer value.

    Covers ``""``, ``0``, ``0.0``, ``False``, ``b""`` and empty container
    displays. ``None`` is excluded: ``x or None`` does not hide a falsy value.
    """
    if isinstance(node, ast.Constant):
        return node.value is not None and not node.value
    # Empty container displays: [], (), {} and empty set literals.
    if isinstance(node, (ast.List, ast.Tuple, ast.Set)):
        return len(node.elts) == 0
    if isinstance(node, ast.Dict):
        return len(node.keys) == 0
    return False


if __name__ == "__main__":
    raise SystemExit(main())
