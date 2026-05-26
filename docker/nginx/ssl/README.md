# Placeholder for SSL certificate chain
#
# In production, mount your TLS certificate files here:
#   ./nginx/ssl/fullchain.pem   ← your domain certificate + intermediate CA(s)
#   ./nginx/ssl/privkey.pem     ← your private key
#
# IMPORTANT: The nginx container must have these files present when
# NGINX_HTTPS_ENABLED=true. If the certs are missing, nginx will fail to start.
#
# For local development with HTTPS disabled (NGINX_HTTPS_ENABLED=false in compose.dev),
# this directory is not needed.
#
# Example mount in docker-compose.prod.yml:
#   volumes:
#     - ./nginx/ssl:/etc/nginx/ssl:ro