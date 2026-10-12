# Reuse the installed, verified runtime without rebuilding/restarting the Web API.
# Build with a minimal context containing only this file and the two worker files.
FROM rentbond-staging-app:local
COPY --chown=node:node apps/worker/src/rpc.mjs /app/apps/worker/src/rpc.mjs
COPY --chown=node:node apps/worker/src/log-ranges.mjs /app/apps/worker/src/log-ranges.mjs
