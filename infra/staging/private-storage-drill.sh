#!/bin/sh
# Same-host recovery drill only; never extracts into the live volume.
set -eu
umask 077
cd /opt/rentbond/repo/infra/staging
CID=$(docker compose --env-file .env.azure -f compose.azure.yaml ps -q web)
test -n "$CID"
DATA_VOLUME=$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/data"}}{{.Source}}{{end}}{{end}}' "$CID")
test -d "$DATA_VOLUME"
install -d -m 0700 /opt/rentbond/private-storage-drills
DRILL_DIR=$(mktemp -d /opt/rentbond/private-storage-drills/run-XXXXXXXX)
install -d -m 0700 "$DRILL_DIR/restored"
tar --one-file-system -czf "$DRILL_DIR/private-data.tar.gz" -C "$DATA_VOLUME" .
tar --extract --gzip --no-same-owner -f "$DRILL_DIR/private-data.tar.gz" -C "$DRILL_DIR/restored"
python3 - "$DATA_VOLUME" "$DRILL_DIR" <<'PY'
import hashlib,json,pathlib,sys
source=pathlib.Path(sys.argv[1])
drill=pathlib.Path(sys.argv[2])
def inventory(root):
    result={}
    for path in sorted(root.rglob('*')):
        if path.is_symlink():
            raise RuntimeError('Recovery drill refuses symlinks.')
        if path.is_file():
            digest=hashlib.sha256()
            with path.open('rb') as stream:
                for block in iter(lambda: stream.read(1024*1024),b''):
                    digest.update(block)
            result[str(path.relative_to(root))]={'size':path.stat().st_size,'sha256':digest.hexdigest()}
    return result
original=inventory(source)
restored=inventory(drill/'restored')
if not original:
    raise RuntimeError('No stored files: empty-volume recovery is not acceptance evidence.')
if original != restored:
    raise RuntimeError('Live files changed or restore differs; do not claim a consistent backup.')
(drill/'inventory.json').write_text(json.dumps(original,sort_keys=True))
print(json.dumps({'storageDrill':'passed','files':len(original),
    'bytes':sum(item['size'] for item in original.values()),'restoreHashMatch':True,
    'liveVolumeReplaced':False,'backupDirectory':str(drill),
    'boundary':'Same VM only; no database recovery, off-host backup or scheduling verified.'}))
PY
