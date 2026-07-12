FROM node:20-alpine

WORKDIR /app

# Copy workspace config
COPY package.json pnpm-lock.yaml ./
COPY packages/server/package.json packages/server/

# Install dependencies
RUN npm install -g pnpm && pnpm install --filter @sandbox/server --prod

# Copy source
COPY packages/server/src packages/server/src
COPY packages/server/tsconfig.json packages/server/

# Build
RUN pnpm --filter @sandbox/server build

EXPOSE 3002

CMD ["node", "packages/server/dist/index.js"]
