"""Build, sign, install and launch BOS42 on a developer-enabled Samsung TV."""
import argparse
import os
import shlex
import xml.etree.ElementTree as ET
import subprocess
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parent.parent
# Node and Python share this ignored dotenv file. Existing process variables win.
local_env = ROOT / '.env.deploy.local'
if local_env.exists():
    for line in local_env.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        if line.startswith('export '):
            line = line[7:]
        name, separator, value = line.partition('=')
        name = name.strip()
        if separator and name in {'TV_HOST', 'TIZEN_SIGNING_PROFILE', 'TIZEN_SDK_PATH'}:
            parsed = shlex.split(value, comments=True)
            os.environ.setdefault(name, ' '.join(parsed))
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--dry-run', action='store_true', help='Print the resolved commands without building, signing, or contacting the TV.')
parser.add_argument('--profile', default=os.environ.get('TIZEN_SIGNING_PROFILE'))
parser.add_argument('--host', default=os.environ.get('TV_HOST'))
parser.add_argument('--sdk', type=Path, default=Path(os.environ.get('TIZEN_SDK_PATH', Path.home() / 'tizen-studio')))
args = parser.parse_args()
if not args.host or not args.profile:
    parser.error('Set TV_HOST and TIZEN_SIGNING_PROFILE in .env.deploy.local, or pass --host and --profile.')
tizen = args.sdk / 'tools/ide/bin/tizen'
sdb = args.sdk / 'tools/sdb'
serial = args.host + ':26101'


def run(*command):
    if args.dry_run:
        print(subprocess.list2cmdline([str(part) for part in command]))
        return
    subprocess.run([str(part) for part in command], cwd=ROOT, check=True)


run(sdb, 'connect', serial)
run('node', 'scripts/build-tizen.mjs')
run(tizen, 'package', '-t', 'wgt', '-s', args.profile, '--', ROOT / 'dist-tizen')
if not args.dry_run:
    with zipfile.ZipFile(ROOT / 'dist-tizen/BOS42.wgt') as package:
        assert {'author-signature.xml', 'signature1.xml', 'config.xml'}.issubset(package.namelist()), 'Package signing is incomplete'
run(tizen, 'install', '-s', serial, '--name', 'BOS42.wgt', '--', ROOT / 'dist-tizen')
app_id = ET.parse(ROOT / 'tizen/config.xml').find('{http://tizen.org/ns/widgets}application').attrib['id']
run(tizen, 'run', '-s', serial, '-p', app_id)
