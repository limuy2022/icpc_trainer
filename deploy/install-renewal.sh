#!/usr/bin/env bash
set -euo pipefail
if [[ ${EUID} -ne 0 ]]; then echo 'Run this script with sudo.'; exit 1; fi
# A separate timer renews only this new certificate, without changing other sites.
if [[ -e /etc/systemd/system/icpc-cert-renew.service || -e /etc/systemd/system/icpc-cert-renew.timer ]]; then
 echo 'An ICPC renewal unit already exists. Inspect it before overwriting.'
 exit 1
fi
cat > /etc/systemd/system/icpc-cert-renew.service <<'UNIT'
[Unit]
Description=Renew only the ICPC website certificate
After=network-online.target
[Service]
Type=oneshot
ExecStart=/usr/bin/certbot renew --cert-name icpc.limuy.top --quiet --deploy-hook "/usr/bin/nginx -t && /usr/bin/systemctl reload nginx"
UNIT
cat > /etc/systemd/system/icpc-cert-renew.timer <<'UNIT'
[Unit]
Description=Check the ICPC certificate renewal daily
[Timer]
OnCalendar=daily
RandomizedDelaySec=3h
Persistent=true
[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload
systemctl enable --now icpc-cert-renew.timer
systemctl start icpc-cert-renew.service
systemctl list-timers icpc-cert-renew.timer --no-pager
