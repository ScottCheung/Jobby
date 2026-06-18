#!/bin/bash

# Exit on error
set -e

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR"

echo "=== Starting Auto Job Apply Application ==="

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "Error: Docker daemon is not running."
    echo "Please start Docker Desktop and try again."
    exit 1
fi

# Define cleanup function to stop containers on exit
cleanup() {
    echo ""
    echo "=== Shutting down Docker containers ==="
    docker compose down
}
# Set up trap to clean up containers on exit (normal exit or interruption)
trap cleanup EXIT

# Start backend containers (postgres, api, user app)
echo "Starting backend containers (Postgres, API, Dashboard) in background..."
docker compose up -d --build

# Wait for API to be ready
echo "Waiting for API service to be ready..."
MAX_ATTEMPTS=30
ATTEMPT=1
READY=0

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
    if curl -s http://127.0.0.1:8000/ready | grep -q '"status":"ready"'; then
        READY=1
        break
    fi
    echo -n "."
    sleep 2
    ATTEMPT=$((ATTEMPT + 1))
done

if [ $READY -eq 1 ]; then
    echo ""
    echo "API is ready!"
else
    echo ""
    echo "Warning: API did not report ready status in time. Attempting to launch desktop client anyway..."
fi

# Check and install desktop dependencies if needed
cd "$SCRIPT_DIR/desktop"
if [ ! -d "node_modules" ]; then
    echo "Installing desktop app dependencies..."
    npm install
fi

# Run the Electron desktop client
echo "Starting Electron desktop client..."
AUTO_JOB_API_URL=http://127.0.0.1:8000 AUTO_JOB_DASHBOARD_URL=http://127.0.0.1:3000 npm run start