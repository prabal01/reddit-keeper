#!/bin/bash

# Reddit Thread Downloader Helper
# Usage: ./download.sh <reddit-url>

URL="$1"

# If no URL provided, prompt for it
if [ -z "$URL" ]; then
    read -p "Enter Reddit Thread URL: " URL
fi

# Still empty? Exit.
if [ -z "$URL" ]; then
    echo "Error: No URL provided."
    exit 1
fi

# Ensure dependencies are installed if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

npx tsx downloader.ts "$URL"
