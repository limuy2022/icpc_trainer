"""Provision first-deploy secrets over SSH stdin. Never prints secret values."""
import getpass
import json
import shlex
import subprocess

key = getpass.getpass('GLM API key (hidden, stored only on target server): ').strip()
if not key or '\n' in key or '\r' in key:
    raise SystemExit('Invalid key')
remote = r'''
import json,os,secrets
from pathlib import Path
values=json.load(__import__('sys').stdin)
base=Path.home()/'apps/icpc-trainer/shared'
base.mkdir(parents=True,exist_ok=True,mode=0o700)
path=base/'app.env'
content='\n'.join([
 'PORT=18461',
 'APP_ORIGIN=https://icpc.limuy.top',
 'COOKIE_SECURE=true',
 'DATABASE_PATH='+str(base/'icpc.sqlite'),
 'MODEL_ENCRYPTION_KEY='+secrets.token_hex(32),
 'GLM_API_KEY='+json.dumps(values['glm']),
 'GLM_MODEL=GLM-5.3',
])+'\n'
fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
with os.fdopen(fd,'w') as f:f.write(content)
print('Created server-only environment configuration with mode 0600.')
'''
subprocess.run(['ssh','-o','ControlPath=/tmp/icpc-ssh-%C','limuy.top','python3 -c '+shlex.quote(remote)],input=json.dumps({'glm':key}),text=True,check=True)
