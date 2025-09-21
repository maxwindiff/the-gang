#!/bin/bash

echo "Starting The Gang servers..."

# Function to handle cleanup
cleanup() {
    echo "Stopping servers..."
    kill $DJANGO_PID $REACT_PID 2>/dev/null
    exit 0
}

# Trap Ctrl+C to cleanup
trap cleanup SIGINT

# Start Django server with ASGI support
echo "Starting Django backend server with ASGI..."
source venv/bin/activate && daphne -p 8000 thegang.asgi:application &
DJANGO_PID=$!

# Wait a moment for Django to start
sleep 3

# Start React server
echo "Starting React frontend server..."
cd frontend && npm start &
REACT_PID=$!

echo "Servers started!"
echo "Django backend: http://localhost:8000"
echo "React frontend: http://localhost:3000"
echo "Press Ctrl+C to stop both servers"

# Wait for both processes
wait $DJANGO_PID $REACT_PID