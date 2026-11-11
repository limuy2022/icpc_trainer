#!/usr/bin/env bash
# Run from a checkout. Replace the installed build; data remains in shared/.
# Keeps the previous build as previous/ and rolls back automatically if the
# new build fails its health check. See deploy/rollback.sh for manual rollback.
set -euo pipefail
project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
server_host="${1:?Usage: bash deploy/update.sh user@your-server [remote-app-directory] [port]}"
remote_base="${2:-DEFAULT}"
app_port="${3:-18461}"
[[ "$app_port" =~ ^[0-9]+$ ]] || { echo "Invalid port" >&2; exit 1; }
ssh_options=(-o BatchMode=yes -o ConnectTimeout=15 -o ControlMaster=auto -o ControlPersist=600 -o ControlPath=/tmp/icpc-ssh-%C)
archive="$(mktemp /tmp/icpc-upload.XXXXXX.tar.gz)"
trap 'rm -f -- "$archive"' EXIT
cd "$project_dir"
pnpm run build:standalone
tar -czf "$archive" -C release .
remote_archive="$(ssh "${ssh_options[@]}" "$server_host" 'mktemp /tmp/icpc-upload.XXXXXX.tar.gz')"
scp "${ssh_options[@]}" "$archive" "$server_host:$remote_archive"
printf -v remote_command 'bash -s -- %q %q %q' "$remote_archive" "$remote_base" "$app_port"
ssh "${ssh_options[@]}" "$server_host" "$remote_command" <<'BASH'
set -euo pipefail
archive="$1"
[[ "$archive" == /tmp/icpc-upload.*.tar.gz ]] || exit 1
base="$HOME/apps/icpc-trainer"
if [[ "$2" != DEFAULT ]]; then base="$2"; fi
app_port="$3"
exec 9>"$base/.deploy.lock"
flock -n 9 || { echo 'Another deployment is running.' >&2; exit 1; }
stage="$(mktemp -d "$base/.incoming.XXXXXX")"
trap 'rm -rf -- "$stage"; rm -f -- "$archive"' EXIT
tar -xzf "$archive" -C "$stage"
test -f "$stage/server.mjs"
test -f "$stage/public/index.html"
test -d "$stage/server/migrations"
# Refuse a legacy symlink or unexpected data inside the code directory.
if [[ -e "$base/current" ]]; then
  test -d "$base/current"
  test ! -L "$base/current"
  if find "$base/current" -type f \( -name '*.sqlite*' -o -name '*.db' -o -name '.env*' \) -print -quit | read -r _; then
    echo 'Unexpected data/config file in current/. Move it to shared/ before updating.' >&2
    exit 1
  fi
fi
systemctl --user start icpc-trainer-backup.service
systemctl --user stop icpc-trainer.service
# Keep exactly one previous build for rollbacks; fresh installs have no current/ yet.
rm -rf -- "$base/previous"
if [[ -d "$base/current" ]]; then
  mv -- "$base/current" "$base/previous"
fi
mv -- "$stage" "$base/current"
rollback() {
  echo 'Health check failed; rolling back to the previous build.' >&2
  rm -rf -- "$base/failed"
  mv -- "$base/current" "$base/failed"
  if [[ -d "$base/previous" ]]; then
    mv -- "$base/previous" "$base/current"
    systemctl --user start icpc-trainer.service
    curl --retry 8 --retry-delay 1 --retry-connrefused -fsS "http://127.0.0.1:$app_port/api/health" >/dev/null \
      && systemctl --user is-active --quiet icpc-trainer.service \
      && { echo 'Rolled back to previous/ (failed build kept as failed/).' >&2; return 1; }
  fi
  echo 'Rollback unavailable; previous build missing or also failing.' >&2
  return 1
}
systemctl --user start icpc-trainer.service
if ! curl --retry 8 --retry-delay 1 --retry-connrefused -fsS "http://127.0.0.1:$app_port/api/health" >/dev/null \
  || ! systemctl --user is-active --quiet icpc-trainer.service; then
  rollback
fi
systemctl --user is-active icpc-trainer.service
echo 'Updated current/; previous build retained in previous/ (rollback: bash deploy/rollback.sh).'
BASH
