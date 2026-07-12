FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY packages/client/package.json packages/client/
COPY packages/engine/package.json packages/engine/
COPY packages/engine/src packages/engine/src
COPY packages/engine/tsconfig.json packages/engine/

RUN npm install -g pnpm && pnpm install --filter @sandbox/client

COPY packages/client .

RUN pnpm --filter @sandbox/client build

FROM nginx:alpine
COPY --from=builder /app/packages/client/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
