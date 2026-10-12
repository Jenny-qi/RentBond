#!/bin/sh
set -eu
cd /app
node infra/staging/config.mjs check infra/staging/public-build.json
case "${1:-}" in
  web) cd apps/web; exec node node_modules/next/dist/bin/next start -H 0.0.0.0 -p 3000 ;;
  api-worker) cd apps/web; exec node src/server/cli.mjs worker ;;
  chain-worker) exec node apps/worker/src/main.ts ;;
  migrate) cd apps/web; exec node src/server/cli.mjs migrate ;;
  verify-services) cd apps/web; exec node src/server/cli.mjs verify-deployment ;;
  profile-import) cd apps/web; exec node src/server/cli.mjs profile-import "${2:?Reviewed manifest path required}" ;;
  *) echo 'Choose web, api-worker, chain-worker, migrate, verify-services or profile-import.' >&2; exit 1 ;;
esac
