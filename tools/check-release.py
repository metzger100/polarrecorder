from __future__ import annotations

import argparse
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RELEASES = ROOT / "releases"


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate polarrecorder release artifacts.")
    parser.add_argument("--dry-run", action="store_true", help="Skip full release validation.")
    args = parser.parse_args()

    zip_files = sorted(RELEASES.glob("*.zip")) if RELEASES.exists() else []
    if args.dry_run and not zip_files:
        print("Release check dry-run passed: no release zip found.")
        return 0
    if args.dry_run:
        print("Release check dry-run passed: full zip validation is scheduled for Phase 10.")
        return 0

    print("Full release validation is scheduled for Phase 10.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
