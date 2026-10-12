FROM node:24.14.0-bookworm-slim
WORKDIR /app
RUN npm install --global pnpm@12.8.1
COPY . .
RUN pnpm install --frozen-lockfile --allow-build=esbuild --allow-build=core-js
RUN npm run backend:abi --prefix apps/web
# Only public, credential-free values are build arguments. Never pass server secrets.
ARG NEXT_PUBLIC_APP_ENV
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_CHAIN_ID
ARG NEXT_PUBLIC_RPC_URL
ARG NEXT_PUBLIC_FACTORY_ADDRESS
ARG NEXT_PUBLIC_RESOLVER_REGISTRY_ADDRESS
ARG CHAIN_CONFIRMATIONS
ENV NEXT_PUBLIC_APP_ENV=$NEXT_PUBLIC_APP_ENV \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_CHAIN_ID=$NEXT_PUBLIC_CHAIN_ID \
    NEXT_PUBLIC_RPC_URL=$NEXT_PUBLIC_RPC_URL \
    NEXT_PUBLIC_FACTORY_ADDRESS=$NEXT_PUBLIC_FACTORY_ADDRESS \
    NEXT_PUBLIC_RESOLVER_REGISTRY_ADDRESS=$NEXT_PUBLIC_RESOLVER_REGISTRY_ADDRESS \
    CHAIN_CONFIRMATIONS=$CHAIN_CONFIRMATIONS \
    NEXT_TELEMETRY_DISABLED=1
RUN node infra/staging/config.mjs record-build infra/staging/public-build.json
RUN npm run build --prefix apps/web
RUN mkdir -p /data && chown -R node:node /data /app/apps/web/.next
USER node
ENV NODE_ENV=production
ENTRYPOINT ["sh", "/app/infra/staging/entrypoint.sh"]
CMD ["web"]
