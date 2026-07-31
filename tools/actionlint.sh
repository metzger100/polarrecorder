#!/usr/bin/env bash
# Checksum-verified actionlint provisioning/invocation for Polar Recorder.
#
# `tools/actionlint.sh --install` downloads the pinned release into a persistent,
# repository-external cache and verifies its SHA-256 checksum. It is the only command
# in this file allowed to touch the network, and only `npm run setup` calls it.
# `tools/actionlint.sh <args...>` (any other invocation) runs the cached binary and
# never downloads; a missing/corrupt cache fails with the exact repair command instead
# of silently falling through to a system-installed actionlint. Checksum verification
# prefers `sha256sum` (Linux) and falls back to `shasum -a 256` (stock macOS ships no
# `sha256sum`); if neither is present, installation fails with one explicit prerequisite
# message before any network or filesystem work happens.
set -euo pipefail

ACTIONLINT_VERSION="1.7.12"
CACHE_DIR="${ACTIONLINT_CACHE_DIR:-$HOME/.cache/polarrecorder/actionlint}"

case "$(uname -s)" in
  Linux) OS="linux" ;;
  Darwin) OS="darwin" ;;
  *) echo "actionlint.sh: unsupported OS $(uname -s); only linux/darwin are provisioned" >&2; exit 1 ;;
esac

case "$(uname -m)" in
  x86_64|amd64) ARCH="amd64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *) echo "actionlint.sh: unsupported architecture $(uname -m)" >&2; exit 1 ;;
esac

archive_name="actionlint_${ACTIONLINT_VERSION}_${OS}_${ARCH}.tar.gz"
binary_path="$CACHE_DIR/$ACTIONLINT_VERSION/actionlint"

case "${archive_name}" in
  actionlint_1.7.12_linux_amd64.tar.gz)
    expected_sha256="8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8" ;;
  actionlint_1.7.12_linux_arm64.tar.gz)
    expected_sha256="325e971b6ba9bfa504672e29be93c24981eeb1c07576d730e9f7c8805afff0c6" ;;
  actionlint_1.7.12_darwin_amd64.tar.gz)
    expected_sha256="5b44c3bc2255115c9b69e30efc0fecdf498fdb63c5d58e17084fd5f16324c644" ;;
  actionlint_1.7.12_darwin_arm64.tar.gz)
    expected_sha256="aba9ced2dee8d27fecca3dc7feb1a7f9a52caefa1eb46f3271ea66b6e0e6953f" ;;
  *)
    echo "actionlint.sh: no pinned checksum for ${archive_name}" >&2
    exit 1
    ;;
esac

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
if [ "${POLARRECORDER_ISOLATED_CHECK:-0}" != "1" ]; then
  case "$CACHE_DIR" in
    "$repo_root"|"$repo_root"/*)
      echo "actionlint.sh: ACTIONLINT_CACHE_DIR must not resolve inside the repository" >&2
      exit 1
      ;;
  esac
fi

if [ "${1:-}" = "--install" ]; then
  if command -v sha256sum >/dev/null 2>&1; then
    checksum_cmd=(sha256sum)
  elif command -v shasum >/dev/null 2>&1; then
    checksum_cmd=(shasum -a 256)
  else
    echo "actionlint.sh: neither sha256sum nor shasum is available; install one to verify the download" >&2
    exit 1
  fi

  mkdir -p "$CACHE_DIR/$ACTIONLINT_VERSION"
  tmp_dir="$(mktemp -d)"
  trap 'rm -rf "$tmp_dir"' EXIT
  url="https://github.com/rhysd/actionlint/releases/download/v${ACTIONLINT_VERSION}/${archive_name}"
  curl -fsSL -o "$tmp_dir/$archive_name" "$url"
  actual_sha256="$("${checksum_cmd[@]}" "$tmp_dir/$archive_name" | cut -d' ' -f1)"
  if [ "$actual_sha256" != "$expected_sha256" ]; then
    echo "actionlint.sh: checksum mismatch for $archive_name (expected $expected_sha256, got $actual_sha256)" >&2
    exit 1
  fi
  tar -xzf "$tmp_dir/$archive_name" -C "$tmp_dir" actionlint
  install -m 0755 "$tmp_dir/actionlint" "$binary_path"
  echo "actionlint.sh: installed actionlint $ACTIONLINT_VERSION to $binary_path"
  exit 0
fi

if [ ! -x "$binary_path" ]; then
  echo "actionlint.sh: no cached actionlint $ACTIONLINT_VERSION at $binary_path" >&2
  echo "actionlint.sh: run 'npm run setup' (or 'tools/actionlint.sh --install') first" >&2
  exit 1
fi

exec "$binary_path" "$@"
