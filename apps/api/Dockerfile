# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
ENV npm_config_ignore_scripts=true

# Install pnpm
RUN npm install -g pnpm@8

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY tsconfig.json ./
COPY tsconfig.base.json ./
COPY packages/schema/package.json packages/schema/
COPY packages/schema/tsconfig.json packages/schema/
COPY packages/schema/tsconfig.declarations.json packages/schema/
COPY packages/core/package.json packages/core/
COPY packages/core/tsconfig.json packages/core/
COPY packages/core/tsconfig.declarations.json packages/core/
COPY packages/db/package.json packages/db/
COPY packages/db/tsconfig.json packages/db/
COPY packages/db/tsconfig.declarations.json packages/db/
COPY apps/api/package.json apps/api/
COPY apps/api/tsconfig.json apps/api/

# Install dependencies
RUN pnpm install --frozen-lockfile --ignore-scripts

# Copy source code
COPY prompts prompts
COPY scripts scripts
COPY packages/schema/src packages/schema/src
COPY packages/schema/tsup.config.ts packages/schema/
COPY packages/core/src packages/core/src
COPY packages/core/tsup.config.ts packages/core/
COPY packages/db/src packages/db/src
COPY packages/db/drizzle packages/db/drizzle
COPY packages/db/drizzle.config.ts packages/db/
COPY packages/db/tsup.config.ts packages/db/
COPY apps/api/src apps/api/src
COPY apps/api/scripts apps/api/scripts
COPY apps/api/tsup.config.ts apps/api/

# Build all packages
RUN pnpm build

# Production stage
FROM node:20-alpine AS production
WORKDIR /app
ENV npm_config_ignore_scripts=true

# Install pnpm
RUN npm install -g pnpm@8

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/schema/package.json packages/schema/
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
COPY apps/api/package.json apps/api/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# Copy built artifacts
COPY --from=builder /app/prompts prompts
COPY --from=builder /app/packages/schema/dist packages/schema/dist
COPY --from=builder /app/packages/core/dist packages/core/dist
COPY --from=builder /app/packages/db/dist packages/db/dist
COPY --from=builder /app/packages/db/drizzle packages/db/drizzle
COPY --from=builder /app/apps/api/dist apps/api/dist

# Expose port
EXPOSE 3000

# Start the API
WORKDIR /app/apps/api
CMD ["node", "dist/index.js"]
