FROM node:22-slim AS build
WORKDIR /app
# Copy package files (context is project root)
COPY apps/dashboard/package.json apps/dashboard/pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
# Copy source (context is project root)
COPY apps/dashboard/ ./
RUN pnpm run build

FROM nginx:alpine
# Copy Angular build output to /dashboard/ subdirectory (matches baseHref)
COPY --from=build /app/dist/dashboard/browser /usr/share/nginx/html/dashboard
COPY apps/dashboard/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 4201
CMD ["nginx", "-g", "daemon off;"]
