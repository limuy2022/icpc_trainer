#!/usr/bin/env bash
set -euo pipefail
if [[ ${EUID} -ne 0 ]]; then echo 'Run this script with sudo.'; exit 1; fi
# Use the distro's existing all-certificate renewal service and timer.
systemctl cat certbot-renew.service >/dev/null
systemctl cat certbot-renew.timer >/dev/null
hook=/etc/letsencrypt/renewal-hooks/deploy/50-managed-nginx-reload
if [[ -e "$hook" ]] && ! grep -q '^# Managed by ICPC deployment: global Certbot nginx reload$' "$hook"; then
 echo "A different hook already exists at $hook. No changes made."
 exit 1
fi
mkdir -p /etc/letsencrypt/renewal-hooks/deploy
cat > "$hook" <<'HOOK'
#!/usr/bin/env bash
# Managed by ICPC deployment: global Certbot nginx reload
set -euo pipefail
if /usr/bin/systemctl is-active --quiet nginx; then
 /usr/bin/nginx -t
 /usr/bin/systemctl reload nginx
fi
HOOK
chmod 755 "$hook"
# Avoid duplicate renewal schedules if the earlier single-site timer was enabled.
if systemctl cat icpc-cert-renew.timer >/dev/null 2>&1; then
 systemctl disable --now icpc-cert-renew.timer
fi
systemctl enable --now certbot-renew.timer
systemctl list-timers certbot-renew.timer --no-pager
printf '\nTesting renewal of every Certbot-managed certificate (staging; no production certificate replacement).\n'
/usr/bin/certbot renew --dry-run --non-interactive --run-deploy-hooks
printf '\nAll-certificate automatic renewal is enabled and the test passed.\n'
