#!/usr/bin/env bash
set -euo pipefail

# Android validation evidence helper.
# Captures logcat and screenshots into artifacts/validation/<timestamp>/.

OUT_ROOT="${OUT_ROOT:-artifacts/validation}"
RUN_ID="${RUN_ID:-$(date +%Y%m%d-%H%M%S)}"
OUT_DIR="${OUT_ROOT}/${RUN_ID}"
TARGET_SERIAL=""
ADB_CMD=(adb)

mkdir -p "${OUT_DIR}"

ensure_adb() {
  if ! command -v adb >/dev/null 2>&1; then
    echo "ERROR: adb not found in PATH."
    exit 1
  fi
}

resolve_target_device() {
  local line
  local -a devices
  local -a device_lines

  while IFS= read -r line; do
    device_lines+=("${line}")
  done < <(adb devices | tail -n +2)

  if [[ -n "${ANDROID_SERIAL:-}" ]]; then
    TARGET_SERIAL="${ANDROID_SERIAL}"
    if ! printf '%s\n' "${device_lines[@]}" | grep -qE "^${TARGET_SERIAL}[[:space:]]+device$"; then
      echo "ERROR: ANDROID_SERIAL=${TARGET_SERIAL} is not in 'device' state."
      echo "Run: adb devices -l"
      exit 1
    fi
    ADB_CMD=(adb -s "${TARGET_SERIAL}")
    return
  fi

  while IFS= read -r line; do
    if [[ -n "${line}" ]]; then
      devices+=("${line}")
    fi
  done < <(printf '%s\n' "${device_lines[@]}" | awk '$2=="device" {print $1}')
  if [[ "${#devices[@]}" -eq 0 ]]; then
    echo "ERROR: no Android device in 'device' state detected by adb."
    echo "Hint: authorize your phone on-device or set ANDROID_SERIAL for a specific target."
    echo "Run: adb devices -l"
    exit 1
  fi

  TARGET_SERIAL="${devices[0]}"
  ADB_CMD=(adb -s "${TARGET_SERIAL}")

  if [[ "${#devices[@]}" -gt 1 ]]; then
    echo "INFO: multiple devices detected; defaulting to ${TARGET_SERIAL}."
    echo "Set ANDROID_SERIAL to target a different device."
  fi
}

start_logcat() {
  "${ADB_CMD[@]}" logcat -c
  nohup "${ADB_CMD[@]}" logcat -v time >"${OUT_DIR}/logcat.txt" 2>&1 &
  LOGCAT_PID=$!
  echo "Started logcat capture for ${TARGET_SERIAL} (pid ${LOGCAT_PID})."
}

stop_logcat() {
  if [[ -n "${LOGCAT_PID:-}" ]]; then
    kill "${LOGCAT_PID}" >/dev/null 2>&1 || true
    wait "${LOGCAT_PID}" 2>/dev/null || true
    echo "Stopped logcat capture."
  fi
}

capture_screenshot() {
  local name="$1"
  local remote="/sdcard/${name}.png"
  local local_path="${OUT_DIR}/${name}.png"

  "${ADB_CMD[@]}" shell screencap -p "${remote}"
  "${ADB_CMD[@]}" pull "${remote}" "${local_path}" >/dev/null
  "${ADB_CMD[@]}" shell rm -f "${remote}" >/dev/null
  echo "Saved screenshot: ${local_path}"
}

usage() {
  cat <<EOF
Usage:
  $(basename "$0") start
  $(basename "$0") screenshot <name>
  $(basename "$0") stop

Environment:
  OUT_ROOT  Output root directory (default: artifacts/validation)
  RUN_ID    Session identifier (default: timestamp)
  ANDROID_SERIAL  Optional adb serial to target specific device

Notes:
  - Use the same RUN_ID for start/screenshot/stop in one test session.
  - Example:
      RUN_ID=net01-a bash scripts/validation/android-evidence-capture.sh start
      RUN_ID=net01-a bash scripts/validation/android-evidence-capture.sh screenshot step-1-denied
      RUN_ID=net01-a bash scripts/validation/android-evidence-capture.sh stop
EOF
}

main() {
  local command="${1:-}"

  case "${command}" in
    start)
      ensure_adb
      resolve_target_device
      start_logcat
      echo "${LOGCAT_PID}" >"${OUT_DIR}/logcat.pid"
      echo "Output directory: ${OUT_DIR}"
      ;;
    screenshot)
      ensure_adb
      resolve_target_device
      local name="${2:-}"
      if [[ -z "${name}" ]]; then
        echo "ERROR: screenshot name is required."
        usage
        exit 1
      fi
      capture_screenshot "${name}"
      ;;
    stop)
      if [[ ! -f "${OUT_DIR}/logcat.pid" ]]; then
        echo "ERROR: ${OUT_DIR}/logcat.pid not found."
        exit 1
      fi
      LOGCAT_PID="$(cat "${OUT_DIR}/logcat.pid")"
      stop_logcat
      rm -f "${OUT_DIR}/logcat.pid"
      echo "Output directory: ${OUT_DIR}"
      ;;
    *)
      usage
      exit 1
      ;;
  esac
}

main "$@"
