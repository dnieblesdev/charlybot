#!/bin/sh
# Nginx entrypoint script — conditionally enables HTTPS based on NGINX_HTTPS_ENABLED
# If NGINX_HTTPS_ENABLED=true and certs are mounted, generate HTTPS server block
# Otherwise, serve HTTP only

set -e

NGINX_HTTPS_ENABLED="${NGINX_HTTPS_ENABLED:-false}"
SSL_CERT="/etc/nginx/ssl/fullchain.pem"
SSL_CERT_KEY="/etc/nginx/ssl/privkey.pem"

# Check if HTTPS should be enabled and SSL certs are present
if [ "$NGINX_HTTPS_ENABLED" = "true" ] && [ -f "$SSL_CERT" ] && [ -f "$SSL_CERT_KEY" ]; then
    echo "[nginx-entrypoint] HTTPS enabled, SSL certs detected — activating HTTPS server block"
    # Export variable so envsubst processes the HTTPS server block in nginx.conf
    export NGINX_HTTPS_ENABLED="true"
else
    if [ "$NGINX_HTTPS_ENABLED" = "true" ]; then
        echo "[nginx-entrypoint] WARNING: NGINX_HTTPS_ENABLED=true but SSL certs not found at $SSL_CERT"
        echo "[nginx-entrypoint] Falling back to HTTP only"
    fi
    # Disable HTTPS block by setting variable that makes the if condition in nginx.conf fail
    export NGINX_HTTPS_ENABLED="false"
fi

echo "[nginx-entrypoint] Starting nginx..."

if [ "$NGINX_HTTPS_ENABLED" = "false" ]; then
    # Remove HTTPS block (from "# ── HTTPS server" marker to EOF)
    # Note: this also removes the closing "}" of the http block (line 259)
    sed '/# ── HTTPS server/,$d' /etc/nginx/nginx.conf > /tmp/nginx-http.conf
    # Re-add the closing "}" for the http block so the config is syntactically valid
    echo "}" >> /tmp/nginx-http.conf
    exec nginx -c /tmp/nginx-http.conf -g "daemon off;"
else
    exec nginx -g "daemon off;"
fi