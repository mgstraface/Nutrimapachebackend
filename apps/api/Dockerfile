# Se construye desde la raíz del repo: docker build -f apps/api/Dockerfile .
FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm install --no-audit --no-fund
COPY packages/shared packages/shared
COPY apps/api apps/api
# tsup mete el paquete shared dentro del bundle; el resto de dependencias quedan externas.
RUN npm run build -w @nutrimapache/api
# package.json de runtime sin el workspace shared (ya está en el bundle)
RUN node -e "const p=require('./apps/api/package.json');delete p.dependencies['@nutrimapache/shared'];delete p.devDependencies;p.scripts={start:'node dist/server.js'};require('fs').writeFileSync('/repo/runtime-package.json',JSON.stringify(p,null,2))"

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /repo/runtime-package.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund
COPY --from=build /repo/apps/api/dist ./dist
USER node
EXPOSE 4000
CMD ["node", "dist/server.js"]
