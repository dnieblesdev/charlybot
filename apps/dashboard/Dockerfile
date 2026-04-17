FROM oven/bun:1 AS build
WORKDIR /app
# Copy package files (context is project root)
COPY apps/dashboard/package.json apps/dashboard/bun.lockb* ./
RUN bun install
# Copy source (context is project root)
COPY apps/dashboard/ ./
RUN bun run build

FROM nginx:alpine
# Copy Angular build output to /dashboard/ subdirectory (matches baseHref)
COPY --from=build /app/dist/dashboard/browser /usr/share/nginx/html/dashboard
COPY apps/dashboard/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 4201
CMD ["nginx", "-g", "daemon off;"]
