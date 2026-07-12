FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY packages/studio/package.json packages/studio/
COPY packages/engine/package.json packages/engine/
COPY packages/engine/src packages/engine/src
COPY packages/engine/tsconfig.json packages/engine/
COPY packages/lua-runtime/package.json packages/lua-runtime/
COPY packages/lua-runtime/src packages/lua-runtime/src
COPY packages/lua-runtime/tsconfig.json packages/lua-runtime/

RUN npm install -g pnpm && pnpm install --filter @sandbox/studio

COPY packages/studio .

RUN pnpm --filter @sandbox/studio build

FROM nginx:alpine
COPY --from=builder /app/packages/studio/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
