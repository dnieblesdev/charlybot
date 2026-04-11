#!/bin/bash
set -e

# Execute the original command (passed via CMD)
# All dependencies are already installed during Docker build stage
exec "$@"