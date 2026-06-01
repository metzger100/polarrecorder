from __future__ import annotations

import argparse
import zipfile
from pathlib import Path

import release_manifest as manifest


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate polarrecorder release artifacts.")
    parser.add_argument("--dry-run", action="store_true", help="Skip full release validation.")
    parser.add_argument(
        "zip_path",
        nargs="?",
        help="Release zip to validate. Defaults to releases/polarrecorder-<version>.zip.",
    )
    args = parser.parse_args()

    try:
        expected = manifest.expected_runtime_names()
        plugin_version = manifest.validate_versions_match()
        if args.dry_run:
            print(
                "Release check dry-run passed: "
                f"{len(expected)} runtime files, version {plugin_version}."
            )
            return 0

        notes_path = manifest.companion_notes_path(plugin_version)
        if not notes_path.is_file():
            raise manifest.ReleaseError(f"Companion release notes are missing: {notes_path}")

        zip_path = Path(args.zip_path) if args.zip_path else manifest.default_zip_path(plugin_version)
        if not zip_path.is_absolute():
            zip_path = manifest.ROOT / zip_path
        validate_zip(zip_path, expected)
    except manifest.ReleaseError as exc:
        print(f"Release check failed: {exc}")
        return 1

    print(f"Release check passed: {zip_path.relative_to(manifest.ROOT)}")
    return 0


def validate_zip(zip_path: Path, expected: set[str]) -> None:
    if not zip_path.is_file():
        raise manifest.ReleaseError(f"Release zip does not exist: {zip_path}")

    try:
        with zipfile.ZipFile(zip_path) as archive:
            names = [info.filename for info in archive.infolist() if not info.is_dir()]
    except zipfile.BadZipFile as exc:
        raise manifest.ReleaseError(f"Release artifact is not a valid zip: {zip_path}") from exc

    normalized = {normalize_zip_name(name) for name in names}
    if len(normalized) != len(names):
        raise manifest.ReleaseError("Release zip contains duplicate entries after normalization")

    missing = sorted(expected - normalized)
    unexpected = sorted(normalized - expected)
    excluded = sorted(name for name in normalized if manifest.is_excluded(name))

    if missing:
        raise manifest.ReleaseError(f"Release zip is missing runtime files: {', '.join(missing)}")
    if unexpected:
        raise manifest.ReleaseError(f"Release zip contains non-runtime files: {', '.join(unexpected)}")
    if excluded:
        raise manifest.ReleaseError(f"Release zip contains excluded paths: {', '.join(excluded)}")


def normalize_zip_name(name: str) -> str:
    normalized = name.replace("\\", "/")
    if normalized.startswith("/") or normalized.startswith("../") or "/../" in normalized:
        raise manifest.ReleaseError(f"Release zip contains unsafe path: {name}")
    return normalized


if __name__ == "__main__":
    raise SystemExit(main())
