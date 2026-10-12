#!/bin/sh
set -eu
RENTBOND_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$RENTBOND_ROOT"
exec docker compose --env-file infra/staging/.env.staging -f infra/staging/compose.yaml "$@"
