FROM node:22-slim AS build
WORKDIR /app

# Enable corepack and install Angular CLI globally
ENV PNPM_HOME="/root/.local/share/pnpm"
ENV PATH="$PNPM_HOME/bin:$PATH"
RUN corepack enable && pnpm add -g @angular/cli@21

# Copy workspace root for pnpm monorepo context
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
# Copy ALL workspace package.json files (pnpm needs complete workspace to resolve)
COPY apps/dashboard/package.json ./apps/dashboard/
COPY apps/landing/package.json ./apps/landing/
COPY apps/bot/package.json ./apps/bot/
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies (full workspace — builder stage is discarded)
RUN pnpm install --no-frozen-lockfile

# Copy source (context is project root)
COPY apps/dashboard/ ./

# Build Angular app from within the dashboard directory
WORKDIR /app/apps/dashboard
RUN pnpm run build

FROM nginx:alpine
# Copy Angular build output to /dashboard/ subdirectory (matches baseHref)
COPY --from=build /app/dist/dashboard/browser /usr/share/nginx/html/dashboard
COPY apps/dashboard/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 4201
CMD ["nginx", "-g", "daemon off;"]
