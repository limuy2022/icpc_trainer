#!/usr/bin/env bash
set -euo pipefail
if [[ ${EUID} -ne 0 ]]; then echo 'Run this script with sudo.'; exit 1; fi
domain="${DOMAIN:?Set DOMAIN to your site hostname}"
app_port="${APP_PORT:-18461}"
tls_listen="${TLS_LISTEN:-443}"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[[ "$domain" =~ ^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$ ]] || { echo 'Invalid domain'; exit 1; }
[[ "$app_port" =~ ^[0-9]+$ && "$tls_listen" =~ ^[0-9.:]+$ ]] || { echo 'Invalid port/listener'; exit 1; }
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
cat > "$snippet" <<NGINX
server {
 listen 80;
 server_name $domain;
 location ^~ /.well-known/acme-challenge/ { root /var/lib/icpc-acme; }
 location / { return 301 https://\$host\$request_uri; }
}
NGINX
if ! nginx -t; then cp -p "$backup" "$config"; echo "Config test failed; original config restored. No reload performed."; exit 1; fi
systemctl reload nginx
if ! test -f "/etc/letsencrypt/live/$domain/fullchain.pem"; then
 certbot certonly --webroot -w /var/lib/icpc-acme -d "$domain"
fi
python3 - "$script_dir/icpc-trainer.nginx.conf" "$snippet" "$domain" "$tls_listen" "$app_port" <<'PY'
from pathlib import Path
import sys
source,target,domain,listener,port=sys.argv[1:]
s=Path(source).read_text().replace('{{DOMAIN}}',domain).replace('{{TLS_LISTEN}}',listener).replace('{{APP_PORT}}',port)
Path(target).write_text(s)
PY
chmod 644 "$snippet"
if ! nginx -t; then
 cp -p "$backup" "$config"
 echo 'TLS config test failed; original config restored. Existing workers were not reloaded with the failed config.'
 exit 1
fi
systemctl reload nginx
printf 'ICPC reverse proxy installed. Original config backup: %s\n' "$backup"
