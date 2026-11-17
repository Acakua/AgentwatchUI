#!/usr/bin/env bash
# Measure opencode models before giving them a role.
#   bash orchestra/bench/run-bench.sh provider/model [provider/model ...]
# Runs in a temp folder, never touches the project. Prints, per model:
#   code score out of 34 + seconds, then the model's answers to the vision test.
set -u
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ $# -gt 0 ] || { echo "usage: run-bench.sh provider/model [...]" >&2; exit 2; }
if [ -z "${ARK_API_KEY:-}" ] && command -v powershell >/dev/null 2>&1; then
  ARK_API_KEY="$(powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable('ARK_API_KEY','User')" | tr -d '\r\n')"; export ARK_API_KEY
fi
work="$(mktemp -d)"; echo "bench dir: $work"
vision_prompt="$(sed '1,/^-----$/d' "$here/vision_prompt.txt")"

for m in "$@"; do
  f="$(echo "$m" | tr '/' '_')"; mkdir -p "$work/code/$f" "$work/vis/$f"; cp "$here/scene.png" "$work/vis/$f/"
  ( s=$(date +%s); timeout "${BENCH_CODE_TIMEOUT:-420}" opencode run --auto -m "$m" --dir "$work/code/$f" --title "[bench] code" -- "$(cat "$here/code_prompt.txt")" >"$work/code/$f.log" 2>&1
    echo "exit=$? secs=$(( $(date +%s) - s ))" >"$work/code/$f.time" ) &
  ( timeout 200 opencode run --auto -m "$m" --dir "$work/vis/$f" --title "[bench] vision" -f "$work/vis/$f/scene.png" -- "$vision_prompt" >"$work/vis/$f.log" 2>&1 ) &
done
wait

for m in "$@"; do
  f="$(echo "$m" | tr '/' '_')"
  echo "=== $m"
  if [ -f "$work/code/$f/calc.js" ]; then echo "code: $(node "$here/check-calc.js" "$work/code/$f/calc.js" 2>&1 | head -1 | cut -c1-300)  [$(cat "$work/code/$f.time")]"
  else echo "code: NO FILE WRITTEN [$(cat "$work/code/$f.time")] (exit=124 means it hung)"; fi
  echo "vision:"; sed 's/\x1b\[[0-9;]*m//g' "$work/vis/$f.log" | grep -v '^$' | tail -7 | cut -c1-160 | sed 's/^/  /'
done
