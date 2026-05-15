FROM node:22-slim AS build
WORKDIR /app

# Enable corepack and install Angular CLI globally
ENV PNPM_HOME="/root/.local/share/pnpm"
ENV PATH="$PNPM_HOME/bin:$PATH"
RUN corepack enable && pnpm add -g @angular/cli@21

# Copy workspace root for pnpm monorepo context
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
# Copy package files (context is project root)
COPY apps/dashboard/package.json ./apps/dashboard/
RUN pnpm install --frozen-lockfile
# Copy source (context is project root)
COPY apps/dashboard/ ./
RUN pnpm run build

FROM nginx:alpine
# Copy Angular build output to /dashboard/ subdirectory (matches baseHref)
COPY --from=build /app/dist/dashboard/browser /usr/share/nginx/html/dashboard
COPY apps/dashboard/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 4201
CMD ["nginx", "-g", "daemon off;"]
