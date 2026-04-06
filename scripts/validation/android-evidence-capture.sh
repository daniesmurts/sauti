#!/usr/bin/env bash
set -euo pipefail

# Android validation evidence helper.
# Captures logcat and screenshots into artifacts/validation/<timestamp>/.

OUT_ROOT="${OUT_ROOT:-artifacts/validation}"
RUN_ID="${RUN_ID:-$(date +%Y%m%d-%H%M%S)}"
OUT_DIR="${OUT_ROOT}/${RUN_ID}"

mkdir -p "${OUT_DIR}"

ensure_adb() {
  if ! command -v adb >/dev/null 2>&1; then
    echo "ERROR: adb not found in PATH."
    exit 1
  fi
}

ensure_device() {
  local state
  state="$(adb get-state 2>/dev/null || true)"
  if [[ "${state}" != "device" ]]; then
    echo "ERROR: no Android device detected by adb."
    echo "Hint: run 'adb devices' and connect a physical device."
    exit 1
  fi
}

start_logcat() {
  adb logcat -c
  adb logcat -v time >"${OUT_DIR}/logcat.txt" 2>&1 &
  LOGCAT_PID=$!
  echo "Started logcat capture (pid ${LOGCAT_PID})."
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

  adb shell screencap -p "${remote}"
  adb pull "${remote}" "${local_path}" >/dev/null
  adb shell rm -f "${remote}" >/dev/null
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
      ensure_device
      start_logcat
      echo "${LOGCAT_PID}" >"${OUT_DIR}/logcat.pid"
      echo "Output directory: ${OUT_DIR}"
      ;;
    screenshot)
      ensure_adb
      ensure_device
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

trap stop_logcat EXIT
main "$@"
