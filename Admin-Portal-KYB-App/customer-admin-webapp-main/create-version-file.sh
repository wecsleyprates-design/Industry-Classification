#!/bin/bash
set -e

# ---- CONFIG ----
APP_NAME="customer-admin-app"
BUILD_DIR="/home/runner/work/build/build/build-artifacts"

echo "🚀 Started creating version file for $APP_NAME..."

# ---- Generate version.json ----
VERSION=$(date +%s)
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

cat <<EOF > $BUILD_DIR/version.json
{
  "version": "$VERSION",
  "timestamp": "$TIMESTAMP"
}
EOF

echo "Version.json created with version: $VERSION"