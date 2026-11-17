#!/usr/bin/env bash
# Run one opencode worker on one brief. Used by the orchestrator (Claude Code).
#
#   orchestra/run-worker.sh <role|provider/model> <brief.md> [project-dir] [-- extra opencode args]
#
# - <role> is looked up in orchestra/roles.conf (next to this script); anything
#   containing "/" is taken as a model id.
# - The worker is told to read AGENTS.md and then do the brief. Nothing else.
# - Output goes to <project-dir>/.orchestra/logs/<time>-<brief>-<role>.log
#   and a one-line result is appended to <project-dir>/.orchestra/runs.tsv
# - Exit code is opencode's exit code (124 = timed out).
#
# Env: WORKER_TIMEOUT (seconds, default 1500), WORKER_VARIANT (opencode --variant).
set -u
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

who="${1:?role or provider/model}"; brief="${2:?brief file}"; shift 2
dir="$PWD"
if [ $# -gt 0 ] && [ "$1" != "--" ]; then dir="$1"; shift; fi
[ "${1:-}" = "--" ] && shift

if [[ "$who" == */* ]]; then model="$who"; role="adhoc"
else
  role="$who"
  model="$(awk -v r="$role" '$1==r {print $2; exit}' "$here/roles.conf")"
  [ -n "$model" ] || { echo "run-worker: unknown role '$role' (see $here/roles.conf)" >&2; exit 2; }
fi

dir="$(cd "$dir" && pwd)" || exit 2
[ -f "$dir/$brief" ] || [ -f "$brief" ] || { echo "run-worker: brief not found: $brief" >&2; exit 2; }
[ -f "$dir/AGENTS.md" ] || { echo "run-worker: $dir/AGENTS.md is missing; workers need it" >&2; exit 2; }

# The BytePlus key lives in the Windows *user* environment. A shell started before
# it was set (or started by an app) does not have it, so load it explicitly.
if [ -z "${ARK_API_KEY:-}" ] && command -v powershell >/dev/null 2>&1; then
  ARK_API_KEY="$(powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable('ARK_API_KEY','User')" | tr -d '\r\n')"
  export ARK_API_KEY
fi
if [[ "$model" == byteplus/* ]] && [ -z "${ARK_API_KEY:-}" ]; then
  echo "run-worker: ARK_API_KEY is not set; byteplus models will fail" >&2; exit 2
fi

name="$(basename "$brief" .md)"
mkdir -p "$dir/.orchestra/logs"
log="$dir/.orchestra/logs/$(date +%Y%m%d-%H%M%S)-$name-$role.log"
prompt="${WORKER_PROMPT:-}"
[ -n "$prompt" ] || prompt="Read AGENTS.md first. Then do the task in $brief exactly as written. Finish with the report block that AGENTS.md asks for."

args=(run --auto -m "$model" --dir "$dir" --title "[$role] $name")
[ -n "${WORKER_VARIANT:-}" ] && args+=(--variant "$WORKER_VARIANT")

echo "run-worker: role=$role model=$model brief=$brief log=$log"
start=$(date +%s)
timeout "${WORKER_TIMEOUT:-1500}" opencode "${args[@]}" "$@" -- "$prompt" >"$log" 2>&1
code=$?
secs=$(( $(date +%s) - start ))
printf '%s\t%s\t%s\t%s\texit=%s\t%ss\t%s\n' "$(date +%F\ %T)" "$role" "$model" "$brief" "$code" "$secs" "$log" >>"$dir/.orchestra/runs.tsv"
echo "run-worker: exit=$code secs=$secs"
echo "----- last lines of the worker's output -----"
sed 's/\x1b\[[0-9;]*m//g' "$log" | tail -40
exit $code
