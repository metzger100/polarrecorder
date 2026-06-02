from __future__ import annotations

import ast
import io
import os
import tokenize
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(os.environ.get("POLARRECORDER_CHECK_ROOT", Path(__file__).resolve().parent.parent))
MAX_NON_EMPTY_LINES = 400
LONG_PACKED_LINE_THRESHOLD = 160
OPERATOR_DENSE_LINE_THRESHOLD = 140
NESTED_PARENS_LINE_THRESHOLD = 80
COLLAPSED_LITERAL_LINE_THRESHOLD = 80
CRAMMED_COMPREHENSION_LINE_THRESHOLD = 100
LAMBDA_PACKED_LINE_THRESHOLD = 80
LONG_PACKED_MIN_BRACKETS = 2
LONG_PACKED_MIN_COMMAS = 2
OPERATOR_DENSE_MIN_OPERATORS = 8
NESTED_PARENS_MIN_COUNT = 14
COLLAPSED_LITERAL_MIN_ITEMS = 4
ONELINER_MESSAGE_BY_KIND = {
    "semicolon-packed": "multiple statements packed onto one line",
    "collapsed-compound-body": "compound statement body collapsed onto one line",
    "chained-conditional": "chained conditional expression collapsed onto one line",
    "collapsed-literal": "large literal collapsed onto one line",
    "crammed-comprehension": "comprehension/lambda packed onto one line",
    "lambda-packed": "lambda expression packed onto one line",
    "long-packed": "very long packed line",
    "operator-dense": "operator-dense packed line",
    "nested-parens": "nested parenthesized expression packed onto one line",
}


@dataclass(frozen=True)
class OnelinerFinding:
    line: int
    kind: str
    length: int


def main() -> int:
    failures: list[str] = []
    for path in iter_python_targets():
        non_empty_lines = count_non_empty_lines(path)
        relative = path.relative_to(ROOT)
        if non_empty_lines > MAX_NON_EMPTY_LINES:
            failures.append(
                f"{relative}: {non_empty_lines} non-empty lines "
                f"(limit {MAX_NON_EMPTY_LINES})"
            )
        if needs_header(path) and not has_module_header(path):
            failures.append(f"{relative}: missing required module header")
        for finding in detect_oneliner_findings(path):
            reason = ONELINER_MESSAGE_BY_KIND[finding.kind]
            failures.append(
                f"{relative}:{finding.line}: {reason} "
                f"({finding.kind}, length {finding.length})"
            )

    if failures:
        for failure in failures:
            print(f"[python-filesize] {failure}")
        return 1

    print("Python file size/header check passed.")
    return 0


def iter_python_targets() -> list[Path]:
    paths: list[Path] = []
    plugin = ROOT / "plugin.py"
    if plugin.exists():
        paths.append(plugin)
    for root_name in ("server/polarrecorder", "tests"):
        root = ROOT / root_name
        if root.exists():
            paths.extend(sorted(root.rglob("*.py")))
    return sorted(set(paths))


def count_non_empty_lines(path: Path) -> int:
    return sum(1 for line in path.read_text(encoding="utf-8").splitlines() if line.strip())


def detect_oneliner_findings(path: Path) -> list[OnelinerFinding]:
    content = path.read_text(encoding="utf-8")
    raw_lines = content.splitlines()
    masked_lines = mask_comments_and_strings(content).splitlines()
    findings_by_line: dict[int, OnelinerFinding] = {}

    for line_number in semicolon_statement_lines(content):
        add_finding(findings_by_line, raw_lines, line_number, "semicolon-packed")

    try:
        tree = ast.parse(content)
    except SyntaxError:
        return sorted(findings_by_line.values(), key=lambda finding: finding.line)

    for node in ast.walk(tree):
        kind = ast_oneliner_kind(node, raw_lines)
        if kind is not None:
            add_finding(findings_by_line, raw_lines, node.lineno, kind)

    for index, masked_line in enumerate(masked_lines, start=1):
        masked_trimmed = masked_line.strip()
        if not masked_trimmed or index in findings_by_line:
            continue
        kind = text_oneliner_kind(masked_trimmed)
        if kind is not None:
            add_finding(findings_by_line, raw_lines, index, kind)

    return sorted(findings_by_line.values(), key=lambda finding: finding.line)


def add_finding(
    findings_by_line: dict[int, OnelinerFinding],
    raw_lines: list[str],
    line_number: int,
    kind: str,
) -> None:
    if line_number in findings_by_line:
        return
    length = len(raw_lines[line_number - 1].strip()) if 0 < line_number <= len(raw_lines) else 0
    findings_by_line[line_number] = OnelinerFinding(line_number, kind, length)


def semicolon_statement_lines(content: str) -> set[int]:
    lines: set[int] = set()
    try:
        tokens = tokenize.generate_tokens(io.StringIO(content).readline)
        for token in tokens:
            if token.type == tokenize.OP and token.string == ";":
                lines.add(token.start[0])
    except tokenize.TokenError:
        return set()
    return lines


def mask_comments_and_strings(content: str) -> str:
    lines = content.splitlines()
    masked = [list(line) for line in lines]
    try:
        tokens = tokenize.generate_tokens(io.StringIO(content).readline)
        for token in tokens:
            if token.type not in {tokenize.COMMENT, tokenize.STRING}:
                continue
            mask_token_range(masked, token.start, token.end)
    except tokenize.TokenError:
        return content
    return "\n".join("".join(line) for line in masked)


def mask_token_range(
    masked: list[list[str]],
    start: tuple[int, int],
    end: tuple[int, int],
) -> None:
    start_line, start_col = start
    end_line, end_col = end
    for line_number in range(start_line, end_line + 1):
        line_index = line_number - 1
        if not 0 <= line_index < len(masked):
            continue
        line = masked[line_index]
        col_start = start_col if line_number == start_line else 0
        col_end = end_col if line_number == end_line else len(line)
        for col in range(col_start, min(col_end, len(line))):
            line[col] = " "


def ast_oneliner_kind(node: ast.AST, raw_lines: list[str]) -> str | None:
    line_number = getattr(node, "lineno", None)
    if not isinstance(line_number, int) or not 0 < line_number <= len(raw_lines):
        return None
    line = raw_lines[line_number - 1].strip()
    if line.startswith(("def ", "async def ", "class ")) and not isinstance(
        node,
        (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef),
    ):
        return None
    if isinstance(node, ast.IfExp) and has_nested_if_expression(node):
        return "chained-conditional"
    if isinstance(node, ast.Lambda) and is_same_line_node(node):
        if len(line) > LAMBDA_PACKED_LINE_THRESHOLD and has_packed_expression_shape(line):
            return "lambda-packed"
    if isinstance(node, (ast.ListComp, ast.SetComp, ast.DictComp, ast.GeneratorExp)):
        if is_crammed_comprehension(node, line):
            return "crammed-comprehension"
    if isinstance(node, (ast.List, ast.Tuple, ast.Set, ast.Dict)) and is_collapsed_literal(node, line):
        return "collapsed-literal"
    if isinstance(node, (ast.If, ast.For, ast.AsyncFor, ast.While, ast.With, ast.AsyncWith, ast.Try)):
        if has_collapsed_body(node, line_number):
            return "collapsed-compound-body"
    if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
        if has_collapsed_body(node, line_number) and not is_short_stub_body(node):
            return "collapsed-compound-body"
    return None


def is_same_line_node(node: ast.AST) -> bool:
    line_number = getattr(node, "lineno", None)
    end_line = getattr(node, "end_lineno", None)
    return isinstance(line_number, int) and line_number == end_line


def has_nested_if_expression(node: ast.IfExp) -> bool:
    return (
        isinstance(node.body, ast.IfExp)
        or isinstance(node.orelse, ast.IfExp)
        or any(isinstance(child, ast.IfExp) for child in ast.iter_child_nodes(node.orelse))
    )


def is_crammed_comprehension(
    node: ast.ListComp | ast.SetComp | ast.DictComp | ast.GeneratorExp,
    line: str,
) -> bool:
    if not is_same_line_node(node) or len(line) <= CRAMMED_COMPREHENSION_LINE_THRESHOLD:
        return False
    generator_count = len(node.generators)
    condition_count = sum(len(generator.ifs) for generator in node.generators)
    return generator_count > 1 or condition_count > 0 or count_top_level_commas(line) >= 2


def is_collapsed_literal(node: ast.List | ast.Tuple | ast.Set | ast.Dict, line: str) -> bool:
    if not is_same_line_node(node) or len(line) <= COLLAPSED_LITERAL_LINE_THRESHOLD:
        return False
    if "Literal[" in line:
        return False
    item_count = len(node.keys) if isinstance(node, ast.Dict) else len(node.elts)
    return item_count >= COLLAPSED_LITERAL_MIN_ITEMS


def has_collapsed_body(node: ast.AST, line_number: int) -> bool:
    bodies = [getattr(node, "body", []), getattr(node, "orelse", []), getattr(node, "finalbody", [])]
    if isinstance(node, ast.Try):
        bodies.extend(handler.body for handler in node.handlers)
    for body in bodies:
        if body and getattr(body[0], "lineno", None) == line_number:
            return True
    return False


def is_short_stub_body(node: ast.FunctionDef | ast.AsyncFunctionDef | ast.ClassDef) -> bool:
    body = node.body
    if len(body) != 1:
        return False
    only_statement = body[0]
    if isinstance(only_statement, ast.Pass):
        return True
    return (
        isinstance(only_statement, ast.Expr)
        and isinstance(only_statement.value, ast.Constant)
        and only_statement.value.value is Ellipsis
    )


def text_oneliner_kind(masked_trimmed_line: str) -> str | None:
    if is_import_line(masked_trimmed_line):
        return None
    line_length = len(masked_trimmed_line)
    bracket_count = count_characters(masked_trimmed_line, "()[]{}")
    comma_count = masked_trimmed_line.count(",")
    operator_count = count_characters(masked_trimmed_line, "+-*/%&|^?:<>!=")
    paren_count = count_characters(masked_trimmed_line, "()")

    if (
        line_length > LONG_PACKED_LINE_THRESHOLD
        and (bracket_count >= LONG_PACKED_MIN_BRACKETS or comma_count >= LONG_PACKED_MIN_COMMAS)
    ):
        return "long-packed"
    if line_length > OPERATOR_DENSE_LINE_THRESHOLD and operator_count >= OPERATOR_DENSE_MIN_OPERATORS:
        return "operator-dense"
    if line_length > NESTED_PARENS_LINE_THRESHOLD and paren_count >= NESTED_PARENS_MIN_COUNT:
        return "nested-parens"
    return None


def is_import_line(masked_trimmed_line: str) -> bool:
    return masked_trimmed_line.startswith(("import ", "from "))


def has_packed_expression_shape(line: str) -> bool:
    return count_characters(line, "()[]{}") >= 2 or line.count(",") >= 2


def count_characters(text: str, characters: str) -> int:
    return sum(1 for char in text if char in characters)


def count_top_level_commas(text: str) -> int:
    paren_depth = 0
    bracket_depth = 0
    brace_depth = 0
    count = 0
    for char in text:
        if char == "(":
            paren_depth += 1
        elif char == ")":
            paren_depth = max(0, paren_depth - 1)
        elif char == "[":
            bracket_depth += 1
        elif char == "]":
            bracket_depth = max(0, bracket_depth - 1)
        elif char == "{":
            brace_depth += 1
        elif char == "}":
            brace_depth = max(0, brace_depth - 1)
        elif char == "," and paren_depth == 0 and bracket_depth == 0 and brace_depth == 0:
            count += 1
    return count


def needs_header(path: Path) -> bool:
    try:
        relative = path.relative_to(ROOT / "server" / "polarrecorder")
    except ValueError:
        return False
    return relative.name != "__init__.py"


def has_module_header(path: Path) -> bool:
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        return line.startswith('"""Module:')
    return False


if __name__ == "__main__":
    raise SystemExit(main())
