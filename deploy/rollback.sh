#!/usr/bin/env bash
# Manually restore the previous build kept by deploy/update.sh.
# Usage: bash deploy/rollback.sh user@your-server [remote-app-directory] [port]
set -euo pipefail
server_host="${1:?Usage: bash deploy/rollback.sh user@your-server [remote-app-directory] [port]}"
remote_base="${2:-DEFAULT}"
app_port="${3:-18461}"
[[ "$app_port" =~ ^[0-9]+$ ]] || { echo "Invalid port" >&2; exit 1; }
ssh_options=(-o BatchMode=yes -o ConnectTimeout=15 -o ControlMaster=auto -o ControlPersist=600 -o ControlPath=/tmp/icpc-ssh-%C)
printf -v remote_command 'bash -s -- %q %q' "$remote_base" "$app_port"
ssh "${ssh_options[@]}" "$server_host" "$remote_command" <<'BASH'
set -euo pipefail
base="$HOME/apps/icpc-trainer"
if [[ "$1" != DEFAULT ]]; then base="$1"; fi
app_port="$2"
exec 9>"$base/.deploy.lock"
flock -n 9 || { echo 'Another deployment is running.' >&2; exit 1; }
test -d "$base/previous" || { echo 'No previous/ build to roll back to.' >&2; exit 1; }
systemctl --user stop icpc-trainer.service
rm -rf -- "$base/failed"
if [[ -d "$base/current" ]]; then
  mv -- "$base/current" "$base/failed"
fi
mv -- "$base/previous" "$base/current"
systemctl --user start icpc-trainer.service
if ! curl --retry 8 --retry-delay 1 --retry-connrefused -fsS "http://127.0.0.1:$app_port/api/health" >/dev/null \
  || ! systemctl --user is-active --quiet icpc-trainer.service; then
  echo 'Rolled-back build failed its health check; it is kept in current/, the replaced one in failed/.' >&2
  exit 1
fi
echo 'Rolled back current/ to the previous build (replaced build kept as failed/).'
BASH
