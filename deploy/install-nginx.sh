#!/usr/bin/env bash
set -euo pipefail
if [[ ${EUID} -ne 0 ]]; then echo 'Run this script with sudo.'; exit 1; fi
base=/home/limuy/apps/icpc-trainer
config=/etc/nginx/nginx.conf
snippet=/etc/nginx/icpc-trainer.conf
stamp=$(date +%Y%m%d-%H%M%S)
backup="${config}.pre-icpc-${stamp}"
cp -p "$config" "$backup"
if [[ -f "$snippet" ]]; then cp -p "$snippet" "${snippet}.pre-${stamp}"; fi
mkdir -p /var/lib/icpc-acme
chmod 755 /var/lib/icpc-acme
# The only edit to the existing config is a dedicated include inside http{}.
python3 - "$config" <<'PY'
import sys,re
p=sys.argv[1]
s=open(p).read()
line='    include /etc/nginx/icpc-trainer.conf;'
if line not in s:
 s,n=re.subn(r'(?m)^http\s*\{',lambda m:m[0]+'\n'+line,s,count=1)
 if n!=1:raise SystemExit('Could not locate exactly one http block; no changes written.')
 open(p,'w').write(s)
PY
cat > "$snippet" <<'NGINX'
server {
 listen 80;
 server_name icpc.limuy.top;
 location ^~ /.well-known/acme-challenge/ { root /var/lib/icpc-acme; }
 location / { return 301 https://$host$request_uri; }
}
NGINX
if ! nginx -t; then cp -p "$backup" "$config"; echo "Config test failed; original config restored. No reload performed."; exit 1; fi
systemctl reload nginx
if ! test -f /etc/letsencrypt/live/icpc.limuy.top/fullchain.pem; then
 certbot certonly --webroot -w /var/lib/icpc-acme -d icpc.limuy.top --non-interactive
fi
install -m 644 "$base/deploy/icpc-trainer.nginx.conf" "$snippet"
if ! nginx -t; then
 cp -p "$backup" "$config"
 echo 'TLS config test failed; original config restored. Existing workers were not reloaded with the failed config.'
 exit 1
fi
systemctl reload nginx
printf 'ICPC reverse proxy installed. Original config backup: %s\n' "$backup"
