# Se construye desde la raíz del repo. Produce los estáticos que sirve Caddy.
FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm install --no-audit --no-fund
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm run build -w @nutrimapache/web

FROM caddy:2-alpine
COPY --from=build /repo/apps/web/dist /srv
COPY docker/Caddyfile /etc/caddy/Caddyfile
