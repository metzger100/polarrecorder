#!/usr/bin/env bash
set -euo pipefail

REPO_OWNER="metzger100"
REPO_NAME="polarrecorder"
PLUGIN_NAME="polarrecorder"
DISPLAY_NAME="Polar Recorder"
SYSTEM_PLUGIN_DIR="/usr/lib/avnav/plugins/${PLUGIN_NAME}"
GITHUB_API="https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest"
GITHUB_RELEASES="https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download"

VERSION="${POLARRECORDER_VERSION:-}"
ZIP_SOURCE=""
DATA_DIR=""
TARGET_DIR=""
USE_SYSTEM=0
NO_RESTART=0
DRY_RUN=0

usage() {
  cat <<USAGE
Usage: install.sh [options]

Install or update Polar Recorder for an AvNav Linux server.

Options:
  --version X.Y.Z     Install a specific GitHub release version.
                     Prereleases such as 1.0.0-beta.1 are supported here.
  --zip PATH_OR_URL   Install from a local or remote zip file.
  --data-dir PATH     Use an AvNav data directory; installs below PATH/plugins.
  --plugin-dir PATH   Use the final polarrecorder plugin directory.
  --system            Install as a system plugin below /usr/lib/avnav/plugins.
  --no-restart        Do not restart AvNav after installation.
  --dry-run           Show the resolved source and target without writing files.
  --help              Show this help.

Environment:
  POLARRECORDER_VERSION=X.Y.Z
  POLARRECORDER_VERSION=1.0.0-beta.1
USAGE
}

log() {
  printf '%s\n' "$*"
}

fail() {
  printf 'polarrecorder installer: %s\n' "$*" >&2
  exit 1
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --version)
      [ "$#" -ge 2 ] || fail "--version requires a value"
      VERSION="$2"
      shift 2
      ;;
    --version=*)
      VERSION="${1#--version=}"
      shift
      ;;
    --zip)
      [ "$#" -ge 2 ] || fail "--zip requires a value"
      ZIP_SOURCE="$2"
      shift 2
      ;;
    --zip=*)
      ZIP_SOURCE="${1#--zip=}"
      shift
      ;;
    --data-dir)
      [ "$#" -ge 2 ] || fail "--data-dir requires a value"
      DATA_DIR="$2"
      shift 2
      ;;
    --data-dir=*)
      DATA_DIR="${1#--data-dir=}"
      shift
      ;;
    --plugin-dir)
      [ "$#" -ge 2 ] || fail "--plugin-dir requires a value"
      TARGET_DIR="$2"
      shift 2
      ;;
    --plugin-dir=*)
      TARGET_DIR="${1#--plugin-dir=}"
      shift
      ;;
    --system)
      USE_SYSTEM=1
      shift
      ;;
    --no-restart)
      NO_RESTART=1
      shift
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      fail "unknown option: $1"
      ;;
  esac
done

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

is_url() {
  case "$1" in
    http://*|https://*) return 0 ;;
    *) return 1 ;;
  esac
}

fetch_to_file() {
  local source="$1"
  local output="$2"

  if command_exists curl; then
    curl -fL --retry 3 --connect-timeout 15 -o "$output" "$source"
    return
  fi
  if command_exists wget; then
    wget -q -O "$output" "$source"
    return
  fi
  fail "curl or wget is required to download ${source}"
}

fetch_text() {
  local source="$1"

  if command_exists curl; then
    curl -fsSL --retry 3 --connect-timeout 15 "$source"
    return
  fi
  if command_exists wget; then
    wget -q -O - "$source"
    return
  fi
  fail "curl or wget is required to resolve the latest release"
}

resolve_latest_version() {
  local json tag

  json="$(fetch_text "$GITHUB_API")"
  tag="$(printf '%s\n' "$json" | sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)"
  [ -n "$tag" ] || fail "could not resolve latest GitHub release"
  printf '%s\n' "${tag#v}"
}

version_zip_url() {
  local version="$1"

  printf '%s/v%s/%s-%s.zip\n' "$GITHUB_RELEASES" "$version" "$PLUGIN_NAME" "$version"
}

path_join_plugin() {
  local data_dir="$1"

  printf '%s/plugins/%s\n' "${data_dir%/}" "$PLUGIN_NAME"
}

service_data_dir() {
  local scope="$1"
  local output

  if [ "$scope" = "user" ]; then
    output="$(systemctl --user show avnav -p ExecStart --value 2>/dev/null || true)"
  else
    output="$(systemctl show avnav -p ExecStart --value 2>/dev/null || true)"
  fi
  printf '%s\n' "$output" | sed -n 's/.*[[:space:]]-b[[:space:]]\([^[:space:];]*\).*/\1/p' | head -n 1
}

process_data_dir() {
  ps -eo args 2>/dev/null \
    | sed -n 's/.*[[:space:]]-b[[:space:]]\([^[:space:]]*\).*/\1/p' \
    | head -n 1
}

pi_user_plugin_dir() {
  local entry home_dir

  entry="$(getent passwd pi 2>/dev/null || true)"
  [ -n "$entry" ] || return 0
  home_dir="$(printf '%s\n' "$entry" | cut -d: -f6)"
  [ -n "$home_dir" ] || return 0
  printf '%s/avnav/data/plugins/%s\n' "$home_dir" "$PLUGIN_NAME"
}

first_existing_target() {
  local candidate

  for candidate in "$@"; do
    [ -n "$candidate" ] || continue
    if [ -d "$candidate" ]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
}

first_existing_data_root() {
  local candidate

  for candidate in "$@"; do
    [ -n "$candidate" ] || continue
    if [ -d "$candidate" ]; then
      path_join_plugin "$candidate"
      return 0
    fi
  done
}

resolve_target_dir() {
  local detected pi_target data_from_service data_from_process

  if [ "$USE_SYSTEM" -eq 1 ]; then
    printf '%s\n' "$SYSTEM_PLUGIN_DIR"
    return 0
  fi
  if [ -n "$TARGET_DIR" ]; then
    printf '%s\n' "${TARGET_DIR%/}"
    return 0
  fi
  if [ -n "$DATA_DIR" ]; then
    path_join_plugin "$DATA_DIR"
    return 0
  fi

  pi_target="$(pi_user_plugin_dir)"
  detected="$(first_existing_target \
    "${HOME:-}/avnav/plugins/${PLUGIN_NAME}" \
    "${HOME:-}/avnav/data/plugins/${PLUGIN_NAME}" \
    "/var/lib/avnav/plugins/${PLUGIN_NAME}" \
    "$pi_target")"
  if [ -n "$detected" ]; then
    printf '%s\n' "$detected"
    return 0
  fi

  if command_exists systemctl; then
    data_from_service="$(service_data_dir user)"
    [ -n "$data_from_service" ] || data_from_service="$(service_data_dir system)"
    if [ -n "$data_from_service" ]; then
      path_join_plugin "$data_from_service"
      return 0
    fi
  fi

  data_from_process="$(process_data_dir)"
  if [ -n "$data_from_process" ]; then
    path_join_plugin "$data_from_process"
    return 0
  fi

  detected="$(first_existing_data_root \
    "${HOME:-}/avnav" \
    "${HOME:-}/avnav/data" \
    "/var/lib/avnav")"
  if [ -n "$detected" ]; then
    printf '%s\n' "$detected"
    return 0
  fi

  fail "could not detect AvNav data/plugins directory; pass --data-dir or --plugin-dir"
}

needs_sudo_for_dir() {
  local dir="$1"
  local probe="$dir"

  while [ ! -e "$probe" ] && [ "$probe" != "/" ]; do
    probe="$(dirname "$probe")"
  done
  [ -w "$probe" ] && return 1
  return 0
}

run_fs() {
  local target_parent="$1"
  shift

  if [ "$DRY_RUN" -eq 1 ]; then
    printf '[dry-run] %s\n' "$*"
    return 0
  fi
  if needs_sudo_for_dir "$target_parent"; then
    command_exists sudo || fail "sudo is required to write ${target_parent}"
    sudo "$@"
    return
  fi
  "$@"
}

extract_zip() {
  local zip_path="$1"
  local extract_dir="$2"

  if command_exists unzip; then
    unzip -q "$zip_path" -d "$extract_dir"
    return
  fi
  if command_exists python3; then
    python3 -m zipfile -e "$zip_path" "$extract_dir"
    return
  fi
  fail "unzip or python3 is required to extract ${zip_path}"
}

validate_extracted_plugin() {
  local extract_dir="$1"
  local plugin_dir="$extract_dir/$PLUGIN_NAME"
  local top_count

  [ -d "$plugin_dir" ] || fail "zip must contain top-level ${PLUGIN_NAME}/ directory"
  [ -f "$plugin_dir/plugin.json" ] || fail "zip is missing ${PLUGIN_NAME}/plugin.json"
  if [ ! -f "$plugin_dir/plugin.js" ] && [ ! -f "$plugin_dir/plugin.mjs" ]; then
    fail "zip is missing plugin.js or plugin.mjs"
  fi

  top_count="$(find "$extract_dir" -mindepth 1 -maxdepth 1 | wc -l | tr -d ' ')"
  [ "$top_count" = "1" ] || fail "zip must contain exactly one top-level directory"
}

copy_or_download_zip() {
  local source="$1"
  local output="$2"

  if is_url "$source"; then
    fetch_to_file "$source" "$output"
    return
  fi
  [ -f "$source" ] || fail "zip file not found: ${source}"
  cp "$source" "$output"
}

replace_target() {
  local source_dir="$1"
  local target_dir="$2"
  local parent stage backup

  parent="$(dirname "$target_dir")"
  stage="${parent}/.${PLUGIN_NAME}.stage.$$"
  backup="${parent}/.${PLUGIN_NAME}.backup.$$"

  run_fs "$parent" mkdir -p "$parent"
  run_fs "$parent" rm -rf "$stage"
  run_fs "$parent" cp -a "$source_dir" "$stage"

  if [ -e "$target_dir" ]; then
    run_fs "$parent" rm -rf "$backup"
    run_fs "$parent" mv "$target_dir" "$backup"
  fi

  if run_fs "$parent" mv "$stage" "$target_dir"; then
    if [ -e "$backup" ]; then
      run_fs "$parent" rm -rf "$backup"
    fi
    return 0
  fi

  if [ -e "$backup" ]; then
    run_fs "$parent" mv "$backup" "$target_dir"
  fi
  fail "failed to replace ${target_dir}; previous install was restored"
}

restart_avnav() {
  if [ "$NO_RESTART" -eq 1 ]; then
    log "AvNav restart skipped (--no-restart)."
    return
  fi
  if ! command_exists systemctl; then
    log "AvNav restart skipped: systemctl not found. Restart AvNav manually."
    return
  fi
  if systemctl --user is-active --quiet avnav 2>/dev/null; then
    systemctl --user restart avnav
    log "Restarted user AvNav service."
    return
  fi
  if systemctl is-active --quiet avnav 2>/dev/null; then
    if systemctl restart avnav 2>/dev/null; then
      log "Restarted system AvNav service."
      return
    fi
    command_exists sudo || fail "sudo is required to restart the system AvNav service"
    sudo systemctl restart avnav
    log "Restarted system AvNav service."
    return
  fi
  log "AvNav service was not restarted automatically. Restart AvNav from the app or system service."
}

main() {
  local source target work_dir zip_path extract_dir

  if [ -n "$ZIP_SOURCE" ]; then
    source="$ZIP_SOURCE"
  else
    if [ -z "$VERSION" ]; then
      VERSION="$(resolve_latest_version)"
    fi
    source="$(version_zip_url "$VERSION")"
  fi

  target="$(resolve_target_dir)"
  log "${DISPLAY_NAME} source: ${source}"
  log "${DISPLAY_NAME} target: ${target}"

  if [ "$DRY_RUN" -eq 1 ]; then
    log "Dry run complete; no files changed."
    return
  fi

  work_dir="$(mktemp -d)"
  trap 'rm -rf "${work_dir:-}"' EXIT
  zip_path="$work_dir/${PLUGIN_NAME}.zip"
  extract_dir="$work_dir/extract"
  mkdir -p "$extract_dir"

  copy_or_download_zip "$source" "$zip_path"
  extract_zip "$zip_path" "$extract_dir"
  validate_extracted_plugin "$extract_dir"
  replace_target "$extract_dir/$PLUGIN_NAME" "$target"
  log "Installed ${DISPLAY_NAME} to ${target}"
  restart_avnav
}

main
