"""Generate `baseline-complexity-source-capture.json`, the immutable JS source inventory.

Usage:
    python tools/quality-policy/generate_baseline_complexity_source_capture.py --write
    python tools/quality-policy/generate_baseline_complexity_source_capture.py --stdout

Records the exact shipped JavaScript production inventory (`plugin.js`, `plugin.mjs`,
every `viewer/*.js` file) at `CAPTURED_COMMIT`: Git blob SHA-1 plus a content SHA-256,
and the strict limits every function in these files must satisfy. This capture
intentionally contains no scanner-dependent findings (no function names, no measured
complexity numbers): the parser/scanner version is locked first, and only then does
`tools/quality-policy/baseline-complexity-capture.mjs` derive findings from the exact
blobs named here, so a scanner-version change can never silently alter which functions
are "pre-existing" versus "new".
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from canonical_json import dumps_canonical, git_blob_content, git_ls_tree_blobs, sha256_text

CAPTURED_COMMIT = "08edef88b0102af6507ef02fd4448f7fd1eaca45"
OUTPUT_PATH = Path(__file__).resolve().parent / "baseline-complexity-source-capture.json"

INTENDED_STRICT_LIMITS = {
    "cyclomaticComplexity": 10,
    "maxStatements": 40,
    "maxNestingDepth": 4,
    "maxParameters": 6,
}


def build_capture() -> dict[str, object]:
    """Build the canonical JS production-source capture from Git at `CAPTURED_COMMIT`.

    Returns:
        The full capture as a JSON-serializable dict, ready for canonical dumping.
    """
    blobs = git_ls_tree_blobs(CAPTURED_COMMIT, "viewer", "plugin.js", "plugin.mjs")
    blobs = {p: h for p, h in blobs.items() if p.endswith((".js", ".mjs"))}

    files = []
    for path in sorted(blobs):
        content = git_blob_content(CAPTURED_COMMIT, path)
        files.append(
            {
                "path": path,
                "gitBlobSha1": blobs[path],
                "contentSha256": sha256_text(content),
            }
        )

    return {
        "capturedCommit": CAPTURED_COMMIT,
        "intendedStrictLimits": INTENDED_STRICT_LIMITS,
        "shippedJavascriptFiles": files,
        "shippedJavascriptFileCount": len(files),
        "note": (
            "No function-level findings are captured here by design; the complexity "
            "scanner derives them from these exact blobs after the parser/scanner "
            "version is locked."
        ),
    }


def main(argv: list[str]) -> int:
    """Run the CLI entry point.

    Args:
        argv: Command-line arguments, excluding the program name.

    Returns:
        The process exit code.
    """
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument(
        "--write", action="store_true", help="write baseline-complexity-source-capture.json"
    )
    group.add_argument("--stdout", action="store_true", help="print canonical JSON, do not write")
    args = parser.parse_args(argv)

    canonical = dumps_canonical(build_capture())
    if args.write:
        OUTPUT_PATH.write_text(canonical, encoding="utf-8")
        sys.stderr.write(f"wrote {OUTPUT_PATH}\n")
    else:
        sys.stdout.write(canonical)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
