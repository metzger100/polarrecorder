from __future__ import annotations

import zipfile

import release_manifest as manifest


def main() -> int:
    version = manifest.validate_versions_match()
    entries = manifest.expected_runtime_files()
    manifest.RELEASES.mkdir(exist_ok=True)
    zip_path = manifest.default_zip_path(version)
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for archive_name, source in entries:
            info = zipfile.ZipInfo(archive_name, manifest.FIXED_ZIP_TIME)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            archive.writestr(info, source.read_bytes())
    print(f"Wrote {zip_path.relative_to(manifest.ROOT)} with {len(entries)} files.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
