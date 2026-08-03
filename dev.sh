#!/bin/bash

# Exit on error
set -e

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR"

echo "=== Starting Auto Job Apply in DEVELOPMENT Mode ==="

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "Error: Docker daemon is not running."
    echo "Please start Docker Desktop and try again."
    exit 1
fi

# Define cleanup function to stop containers and dev servers on exit
cleanup() {
    echo ""
    echo "=== Shutting down development environment ==="
    # Kill the background Next.js dev server
    if [ ! -z "$NEXT_DEV_PID" ]; then
        echo "Stopping Next.js dev server (PID: $NEXT_DEV_PID)..."
        kill $NEXT_DEV_PID 2>/dev/null || true
    fi
    echo "Note: Backend Docker containers (Postgres, API) are kept running in the background for fast startup."
    echo "To stop them manually, run: docker compose down"
}
# Set up trap to clean up on exit (normal exit or interruption)
trap cleanup EXIT

# Start backend containers (postgres and api only, leaving frontend for local dev)
echo "Starting backend containers (Postgres, API) in background..."
docker compose up -d postgres api

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
    echo "Warning: API did not report ready status in time. Attempting to start dev server anyway..."
fi

# Check and install frontend dependencies if needed
cd "$SCRIPT_DIR/Apps/user"
if [ ! -d "node_modules" ]; then
    echo "Installing frontend app dependencies..."
    npm install
fi

# Start Next.js dev server in the background
echo "Starting Next.js dev server in background..."
npm run dev &
NEXT_DEV_PID=$!

# Wait for Next.js server to be ready on port 3000
echo "Waiting for Next.js frontend (http://127.0.0.1:3000) to be ready..."
FRONTEND_ATTEMPTS=30
FRONTEND_ATTEMPT=1
FRONTEND_READY=0

while [ $FRONTEND_ATTEMPT -le $FRONTEND_ATTEMPTS ]; do
    if curl -s --max-time 1 http://127.0.0.1:3000 >/dev/null 2>&1; then
        FRONTEND_READY=1
        break
    fi
    echo -n "."
    sleep 1
    FRONTEND_ATTEMPT=$((FRONTEND_ATTEMPT + 1))
done

if [ $FRONTEND_READY -eq 1 ]; then
    echo ""
    echo "Frontend is ready!"
else
    echo ""
    echo "Warning: Frontend did not report ready status in time. Attempting to start Desktop client anyway..."
fi

# Check and install desktop dependencies if needed
cd "$SCRIPT_DIR/desktop"
if [ ! -d "node_modules" ]; then
    echo "Installing desktop app dependencies..."
    npm install
fi

# Run the Electron desktop client pointing to local dev servers
echo "Starting Electron desktop client (Hot Reloading)..."
AUTO_JOB_API_URL=http://127.0.0.1:8000 AUTO_JOB_DASHBOARD_URL=http://127.0.0.1:3000 npm run dev
