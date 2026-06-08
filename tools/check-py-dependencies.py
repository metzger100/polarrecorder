#!/usr/bin/env python3
"""Fail-closed dependency-layering checker for server/polarrecorder/.

Enforces the two architectural guarantees that ruff/mypy cannot see:

- header-accuracy : every module's ``Depends:`` header lists exactly the
                    intra-package modules it imports - no undeclared imports
                    (the header silently drifts) and no stale declarations
                    (a dependency that was removed). Both runtime and
                    ``TYPE_CHECKING`` imports of ``polarrecorder.*`` count,
                    matching the convention in coding-standards.md.
- no-cycles       : the runtime import graph is acyclic. ``TYPE_CHECKING``
                    edges are excluded because that guard is precisely how
                    Python breaks a runtime import cycle, so a type-only edge
                    is not a real cycle.
- layer-direction : every runtime import points at the same or a lower
                    architectural layer. A foundational module (e.g.
                    ``units``) may never import an orchestration module (e.g.
                    ``api_dispatch``); dependencies flow downward only. This is
                    the flat-package twin of the dyninstruments
                    ``dependency-direction`` layer check.
- layer-map-stale : the ``_LAYER_RANK`` map matches the real package - every
                    domain module is assigned exactly one layer and no mapped
                    name has been renamed or deleted. Independent of the scan
                    root so the per-file scan can be redirected without
                    silently disabling completeness (the twin of the
                    ``canonical-helper-map-stale`` guard in check-py-contracts).

Scope is server/polarrecorder/ only; ``__init__.py`` files carry no header and
are skipped for the header check (but still contribute import edges).

Run from the repo root (or set POLARRECORDER_CHECK_ROOT). Exit 0 when clean,
1 when any violation is found.
"""

from __future__ import annotations

import ast
import os
import sys
from pathlib import Path

ROOT = Path(os.environ.get("POLARRECORDER_CHECK_ROOT", Path(__file__).resolve().parent.parent))
PACKAGE = "polarrecorder"

# Architectural layers, keyed by module name relative to the package. A module
# may import only modules in the same or a lower-ranked layer; dependencies
# flow downward (orchestration -> domain -> core -> primitives), never up. Keep
# this map equal to reality: ``layer-map-stale`` fails the gate if a domain
# module is unassigned or a mapped name no longer exists.
_LAYER_NAMES = {0: "primitives", 1: "core", 2: "domain", 3: "orchestration"}
_LAYER_RANK = {
    # 0 - primitives: no intra-package dependencies.
    "units": 0,
    "coerce": 0,
    "logger": 0,
    "params": 0,
    "bins": 0,
    "histogram": 0,
    "import_common": 0,
    "validation.angle_math": 0,
    "validation.rules_enhanced": 0,
    # 1 - core: typed samples, config, and single-purpose accumulators.
    "sample": 1,
    "config": 1,
    "counters": 1,
    "projection": 1,
    "validation.state": 1,
    # 2 - domain: the learned model, export, intake, and validation rules.
    "polar_model": 2,
    "export": 2,
    "preset_backup": 2,
    "reader": 2,
    "timeline": 2,
    "validation.rules_core": 2,
    "validation.rules_heuristic": 2,
    "validation.rules_stability": 2,
    # 3 - orchestration: composition roots wired by plugin.py.
    "restore": 3,
    "persistence": 3,
    "validation.pipeline": 3,
    "commit": 3,
    "api_handlers": 3,
    "api_dispatch": 3,
}
# Package markers carry no logic and are exempt from a layer assignment.
_LAYER_EXEMPT = {"", "validation"}


def _short_name(module: str) -> str:
    """Return the module name relative to the package (drops the prefix)."""
    if module == PACKAGE:
        return ""
    return module[len(PACKAGE) + 1 :]


def main() -> int:
    """Scan domain modules and report dependency violations.

    Returns:
        Process exit code: 0 when clean, 1 when violations are found.
    """
    scan_root = ROOT / "server" / PACKAGE
    paths = sorted(scan_root.rglob("*.py"))
    known = {_module_name(path) for path in paths}

    failures: list[str] = []
    runtime_graph: dict[str, set[str]] = {}
    for path in paths:
        module = _module_name(path)
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        all_deps, runtime_deps = _imports(tree, module, known)
        runtime_graph[module] = runtime_deps
        failures.extend(_check_header(path, module, tree, all_deps))

    failures.extend(_check_cycles(runtime_graph))
    failures.extend(_check_layers(runtime_graph))
    failures.extend(validate_layer_map())

    if failures:
        for failure in sorted(failures):
            sys.stderr.write(f"[py-deps] {failure}\n")
        sys.stderr.write(f"[py-deps] {len(failures)} violation(s) found.\n")
        return 1
    sys.stdout.write("Dependency check passed.\n")
    return 0


def _module_name(path: Path) -> str:
    """Return the dotted module name for a file under server/."""
    rel = path.relative_to(ROOT / "server").with_suffix("")
    parts = list(rel.parts)
    if parts[-1] == "__init__":
        parts.pop()
    return ".".join(parts)


def _imports(tree: ast.AST, module: str, known: set[str]) -> tuple[set[str], set[str]]:
    """Return (all intra-package deps, runtime-only deps) for a module.

    Args:
        tree: Parsed module AST.
        module: Dotted name of the module being scanned (excluded from deps).
        known: Every dotted module name that exists in the package.

    Returns:
        A pair of dependency sets. The first counts every ``polarrecorder.*``
        import including ``TYPE_CHECKING`` ones (used for header accuracy); the
        second counts only imports reached at runtime (used for cycle checks).
    """
    all_deps: set[str] = set()
    runtime_deps: set[str] = set()
    type_only = _type_checking_nodes(tree)
    for node in ast.walk(tree):
        if not isinstance(node, (ast.Import, ast.ImportFrom)):
            continue
        for dep in _resolve_deps(node, known):
            if dep == module:
                continue
            all_deps.add(dep)
            if node not in type_only:
                runtime_deps.add(dep)
    return all_deps, runtime_deps


def _type_checking_nodes(tree: ast.AST) -> set[ast.AST]:
    """Return all import nodes nested under an ``if TYPE_CHECKING:`` block."""
    out: set[ast.AST] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.If) and _is_type_checking_test(node.test):
            for inner in node.body:
                for child in ast.walk(inner):
                    if isinstance(child, (ast.Import, ast.ImportFrom)):
                        out.add(child)
    return out


def _is_type_checking_test(test: ast.expr) -> bool:
    """Return True for a ``TYPE_CHECKING`` / ``typing.TYPE_CHECKING`` test."""
    if isinstance(test, ast.Name):
        return test.id == "TYPE_CHECKING"
    if isinstance(test, ast.Attribute):
        return test.attr == "TYPE_CHECKING"
    return False


def _resolve_deps(node: ast.Import | ast.ImportFrom, known: set[str]) -> set[str]:
    """Resolve an import node to the intra-package modules it depends on.

    A single statement can pull in several submodules (``from polarrecorder
    import a, b``), so this returns a set. For each imported name, a
    ``base.name`` that is itself a module resolves to that submodule;
    otherwise the name is a symbol and resolves to its containing module.
    Symbols re-exported from the bare package ``__init__`` resolve to the
    package and are ignored.
    """
    out: set[str] = set()
    if isinstance(node, ast.Import):
        for alias in node.names:
            if alias.name in known and alias.name != PACKAGE:
                out.add(alias.name)
        return out
    base = node.module or ""
    if base != PACKAGE and not base.startswith(f"{PACKAGE}."):
        return out
    for alias in node.names:
        submodule = f"{base}.{alias.name}"
        if submodule in known:
            out.add(submodule)
        elif base in known and base != PACKAGE:
            out.add(base)
    return out


def _check_header(
    path: Path, module: str, tree: ast.AST, all_deps: set[str]
) -> list[str]:
    """Compare the ``Depends:`` header against the module's real imports."""
    if module == PACKAGE or path.name == "__init__.py":
        return []
    rel = path.relative_to(ROOT).as_posix()
    declared = _declared_depends(ast.get_docstring(tree, clean=False))
    if declared is None:
        return [f"{rel}: module header is missing a 'Depends:' line"]
    findings: list[str] = []
    for missing in sorted(all_deps - declared):
        findings.append(
            f"{rel}: imports '{missing}' but the 'Depends:' header omits it"
        )
    for stale in sorted(declared - all_deps):
        findings.append(
            f"{rel}: 'Depends:' header lists '{stale}' but it is not imported"
        )
    return findings


def _declared_depends(docstring: str | None) -> set[str] | None:
    """Parse the ``Depends:`` field (possibly multi-line) from a docstring.

    Returns the declared module set, an empty set for ``Depends: none``, or
    None when no ``Depends:`` line is present.
    """
    if docstring is None:
        return None
    lines = docstring.splitlines()
    for index, line in enumerate(lines):
        stripped = line.strip()
        if not stripped.startswith("Depends:"):
            continue
        collected = stripped[len("Depends:") :]
        for follow in lines[index + 1 :]:
            tail = follow.strip()
            if not tail or ":" in tail.split(" ", 1)[0]:
                break
            collected += " " + tail
        entries = {item.strip() for item in collected.split(",")}
        entries.discard("")
        if entries == {"none"}:
            return set()
        return entries
    return None


def _check_cycles(graph: dict[str, set[str]]) -> list[str]:
    """Return one finding per cycle in the runtime import graph."""
    findings: list[str] = []
    visiting: set[str] = set()
    visited: set[str] = set()
    stack: list[str] = []

    def visit(node: str) -> None:
        if node in visiting:
            cycle = stack[stack.index(node) :] + [node]
            findings.append("runtime import cycle: " + " -> ".join(cycle))
            return
        if node in visited:
            return
        visiting.add(node)
        stack.append(node)
        for nxt in sorted(graph.get(node, set())):
            visit(nxt)
        stack.pop()
        visiting.discard(node)
        visited.add(node)

    for module in sorted(graph):
        visit(module)
    return findings


def _check_layers(graph: dict[str, set[str]]) -> list[str]:
    """Return one finding per runtime import that points at a higher layer.

    Only edges whose endpoints both carry a layer assignment are checked, so a
    redirected scan over synthetic fixtures is unaffected; completeness against
    the real package is enforced separately by :func:`validate_layer_map`.
    """
    findings: list[str] = []
    for module in sorted(graph):
        source = _short_name(module)
        source_rank = _LAYER_RANK.get(source)
        if source_rank is None:
            continue
        for dep in sorted(graph[module]):
            target = _short_name(dep)
            target_rank = _LAYER_RANK.get(target)
            if target_rank is None:
                continue
            if target_rank > source_rank:
                findings.append(
                    f"layer-direction: '{source}' ({_LAYER_NAMES[source_rank]}) "
                    f"imports '{target}' ({_LAYER_NAMES[target_rank]}); "
                    "dependencies must flow to the same or a lower layer"
                )
    return findings


def validate_layer_map(
    layers: dict[str, int] | None = None, package_dir: Path | None = None
) -> list[str]:
    """Return ``layer-map-stale`` findings if ``_LAYER_RANK`` drifts from reality.

    Independent of the scan ``ROOT`` so the per-file scan can be redirected at a
    fixture while completeness is still measured against the real package.

    Args:
        layers: Layer map to validate; defaults to the live ``_LAYER_RANK``.
        package_dir: Real package directory; defaults to the repository copy.

    Returns:
        One finding per unassigned real module and per mapped name that no
        longer exists on disk.
    """
    layers = _LAYER_RANK if layers is None else layers
    if package_dir is None:
        real_root = Path(
            os.environ.get("POLARRECORDER_CHECK_ROOT", Path(__file__).resolve().parent.parent)
        )
        package_dir = real_root / "server" / PACKAGE

    real_modules: set[str] = set()
    for path in sorted(package_dir.rglob("*.py")):
        rel = path.relative_to(package_dir).with_suffix("")
        parts = [part for part in rel.parts if part != "__init__"]
        name = ".".join(parts)
        if name in _LAYER_EXEMPT:
            continue
        real_modules.add(name)

    findings: list[str] = []
    for name in sorted(real_modules - set(layers)):
        findings.append(
            f"layer-map-stale: module '{name}' has no layer; "
            "assign it in the _LAYER_RANK map in check-py-dependencies.py"
        )
    for name in sorted(set(layers) - real_modules):
        findings.append(
            f"layer-map-stale: '{name}' is mapped to a layer but no such module "
            "exists; fix the _LAYER_RANK map in check-py-dependencies.py"
        )
    return findings


if __name__ == "__main__":
    raise SystemExit(main())
