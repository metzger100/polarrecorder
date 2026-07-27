from __future__ import annotations

import argparse
import hashlib
import io
import re
import zipfile
from pathlib import Path

import release_manifest as manifest

ZIP_NAME_RE = re.compile(r"^polarrecorder-(?P<version>.+)\.zip$")


def main() -> int:
    """Validate polarrecorder release artifacts, or dry-run an in-memory build.

    Returns:
        Process exit code: 0 on success, 1 on a `ReleaseError`.
    """
    parser = argparse.ArgumentParser(description="Validate polarrecorder release artifacts.")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help=(
            "Build and validate a temporary in-memory development-version artifact; "
            "never touches releases/."
        ),
    )
    parser.add_argument("--version", help="SemVer release version without v prefix.")
    parser.add_argument(
        "zip_path",
        nargs="?",
        help="Release zip to validate. If omitted, --version selects the canonical path.",
    )
    args = parser.parse_args()

    try:
        expected_entries = manifest.expected_runtime_files()
        if args.dry_run:
            zip_bytes = manifest.build_zip_bytes(manifest.DEV_VERSION, expected_entries)
            validate_zip_bytes(zip_bytes, expected_entries, manifest.DEV_VERSION)
            print(
                f"Release check dry-run passed: {len(expected_entries)} runtime files "
                f"(in-memory {manifest.DEV_VERSION} artifact built and validated)."
            )
            return 0

        release_version = resolve_release_version(args.version, args.zip_path)
        manifest.validate_versions_match(release_version)

        notes_path = manifest.companion_notes_path(release_version)
        require_notes_file(notes_path)

        zip_path = (
            Path(args.zip_path) if args.zip_path else manifest.default_zip_path(release_version)
        )
        if not zip_path.is_absolute():
            zip_path = manifest.ROOT / zip_path
        validate_zip_file(zip_path, expected_entries, release_version)
    except manifest.ReleaseError as exc:
        print(f"Release check failed: {exc}")
        return 1

    print(f"Release check passed: {zip_path.relative_to(manifest.ROOT)}")
    return 0


def require_notes_file(notes_path: Path) -> None:
    """Raise a `ReleaseError` if the companion release-notes file is missing."""
    if not notes_path.is_file():
        raise manifest.ReleaseError(f"Companion release notes are missing: {notes_path}")


def resolve_release_version(version: str | None, zip_path: str | None) -> str:
    if version is not None:
        manifest.validate_semver(version)
        return version
    if zip_path is not None:
        match = ZIP_NAME_RE.match(Path(zip_path).name)
        if not match:
            raise manifest.ReleaseError(
                "Could not infer release version from zip name; pass --version"
            )
        inferred = match.group("version")
        manifest.validate_semver(inferred)
        return inferred
    raise manifest.ReleaseError("Release version is required; pass --version or a release zip path")


def validate_zip_file(
    zip_path: Path,
    expected_entries: list[tuple[str, Path]],
    release_version: str,
) -> None:
    if not zip_path.is_file():
        raise manifest.ReleaseError(f"Release zip does not exist: {zip_path}")
    try:
        with zipfile.ZipFile(zip_path) as archive:
            validate_zip_archive(archive, expected_entries, release_version)
    except zipfile.BadZipFile as exc:
        raise manifest.ReleaseError(f"Release artifact is not a valid zip: {zip_path}") from exc


def validate_zip_bytes(
    zip_bytes: bytes,
    expected_entries: list[tuple[str, Path]],
    release_version: str,
) -> None:
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as archive:
        validate_zip_archive(archive, expected_entries, release_version)


def validate_zip_archive(
    archive: zipfile.ZipFile,
    expected_entries: list[tuple[str, Path]],
    release_version: str,
) -> None:
    names = [info.filename for info in archive.infolist() if not info.is_dir()]
    normalized_to_original = {
        manifest.runtime_name_from_archive(normalize_zip_name(name)): name for name in names
    }
    validate_zip_contents(archive, normalized_to_original, expected_entries, release_version)

    normalized = {manifest.runtime_name_from_archive(normalize_zip_name(name)) for name in names}
    if len(normalized) != len(names):
        raise manifest.ReleaseError("Release zip contains duplicate entries after normalization")

    expected = {name for name, _source in expected_entries}
    missing = sorted(expected - normalized)
    unexpected = sorted(normalized - expected)
    excluded = sorted(name for name in normalized if manifest.is_excluded(name))

    if missing:
        raise manifest.ReleaseError(f"Release zip is missing runtime files: {', '.join(missing)}")
    if unexpected:
        raise manifest.ReleaseError(
            f"Release zip contains non-runtime files: {', '.join(unexpected)}"
        )
    if excluded:
        raise manifest.ReleaseError(f"Release zip contains excluded paths: {', '.join(excluded)}")


def validate_zip_contents(
    archive: zipfile.ZipFile,
    normalized_to_original: dict[str, str],
    expected_entries: list[tuple[str, Path]],
    release_version: str,
) -> None:
    drifted = []
    for name, source in expected_entries:
        original_name = normalized_to_original.get(name)
        if original_name is None:
            continue
        actual_hash = hashlib.sha256(archive.read(original_name)).hexdigest()
        expected_bytes = manifest.runtime_file_bytes(name, source, release_version)
        expected_hash = hashlib.sha256(expected_bytes).hexdigest()
        if actual_hash != expected_hash:
            drifted.append(name)
    if drifted:
        raise manifest.ReleaseError(
            "Release zip contents differ from source files: " + ", ".join(sorted(drifted))
        )


def normalize_zip_name(name: str) -> str:
    normalized = name.replace("\\", "/")
    if normalized.startswith(("/", "../")) or "/../" in normalized:
        raise manifest.ReleaseError(f"Release zip contains unsafe path: {name}")
    return normalized


if __name__ == "__main__":
    raise SystemExit(main())
