#!/bin/bash

echo "Starting The Gang server..."

# Function to handle cleanup
cleanup() {
    echo "Stopping server..."
    kill $DJANGO_PID 2>/dev/null
    exit 0
}

# Trap Ctrl+C to cleanup
trap cleanup SIGINT

# Build React frontend
echo "Building React frontend..."
cd frontend && npm run build
cd ..

# Start Django server with ASGI support (serves both frontend and API)
echo "Starting Django server with ASGI (serving frontend and API)..."
source venv/bin/activate && daphne -b 0.0.0.0 -p 80 thegang.asgi:application &
DJANGO_PID=$!

echo "Production server started!"
echo "Application: http://localhost"
echo "Press Ctrl+C to stop the server"

# Wait for the process
wait $DJANGO_PID