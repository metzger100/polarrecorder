from __future__ import annotations

import argparse
import json

import release_manifest as manifest


def main() -> int:
    """Build the Polar Recorder release zip and report its manifest as JSON.

    Returns:
        Process exit code: always 0 on success (errors raise and propagate).
    """
    parser = argparse.ArgumentParser(description="Build the Polar Recorder release zip.")
    parser.add_argument("--version", required=True, help="SemVer release version without v prefix.")
    args = parser.parse_args()

    version = manifest.validate_versions_match(args.version)
    entries = manifest.expected_runtime_files()
    manifest.RELEASES.mkdir(exist_ok=True)
    zip_path = manifest.default_zip_path(version)
    zip_path.write_bytes(manifest.build_zip_bytes(version, entries))
    print(f"Wrote {zip_path.relative_to(manifest.ROOT)} with {len(entries)} files.")
    print(
        "SUMMARY_JSON="
        + json.dumps({"filesIncluded": len(entries), "totalSizeBytes": zip_path.stat().st_size})
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
