"""Create a server-only environment file; never print API keys or overwrite config."""
import argparse
import getpass
import json
import shlex
import subprocess
from urllib.parse import urlparse

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('host', help='SSH target, e.g. deploy@example.com')
parser.add_argument('--origin', required=True, help='Public HTTPS origin')
parser.add_argument('--port', type=int, default=18461)
parser.add_argument('--base-url', default='')
parser.add_argument('--model', default='')
parser.add_argument('--provider', choices=['openai-compatible', 'glm'], default='openai-compatible')
args = parser.parse_args()
origin = urlparse(args.origin)
if origin.scheme != 'https' or not origin.hostname or origin.username or origin.password or origin.query or origin.fragment or origin.path not in ['', '/']:
    parser.error('--origin must be an HTTPS origin without a path')
if not 1 <= args.port <= 65535:
    parser.error('invalid port')
key = getpass.getpass('Model API key (hidden; leave empty to use the admin panel): ').strip()
if '\n' in key or '\r' in key:
    raise SystemExit('Invalid key')
if key and (not args.base_url.startswith('https://') or not args.model):
    parser.error('an API key requires --base-url and --model')
remote = r'''
import json,os,secrets
from pathlib import Path
values=json.load(__import__('sys').stdin)
base=Path.home()/'apps/icpc-trainer/shared'
base.mkdir(parents=True,exist_ok=True,mode=0o700)
path=base/'app.env'
settings={
 'PORT':str(values['port']), 'APP_ORIGIN':values['origin'].rstrip('/'),
 'COOKIE_SECURE':'true', 'DATABASE_PATH':str(base/'icpc.sqlite'),
 'MODEL_ENCRYPTION_KEY':secrets.token_hex(32),
 'AI_API_KEY':values['key'], 'AI_BASE_URL':values['base_url'],
 'AI_MODEL':values['model'], 'AI_PROVIDER':values['provider'],
}
content='\n'.join(k+'='+json.dumps(v) for k,v in settings.items())+'\n'
fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
with os.fdopen(fd,'w') as f:f.write(content)
print('Created server-only environment configuration with mode 0600.')
'''
subprocess.run(['ssh','--',args.host,'python3 -c '+shlex.quote(remote)], input=json.dumps({**vars(args),'key':key}),text=True,check=True)
