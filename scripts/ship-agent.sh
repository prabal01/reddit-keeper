#!/bin/bash
# ship-agent.sh
# 
# This script builds, pushes, and DEPLOYS the Unified Marketing Bot to Cloud Run.

set -e

PROJECT_ID="redditkeeperprod"
SERVICE_NAME="marketing-agent"
REGION="us-central1"
GCR_PATH="gcr.io/$PROJECT_ID/$SERVICE_NAME:latest"

echo "=========================================="
echo " 🚀 Shipping Unified Marketing Bot to Cloud Run"
echo "=========================================="

# Load .env variables from the root
ENV_FILE="$(dirname "$0")/../.env"
if [ -f "$ENV_FILE" ]; then
    echo "📄 Loading environment variables from .env..."
    # Only export lines that are valid bash identifiers (no hyphens, start with letter/underscore)
    while IFS= read -r line || [ -n "$line" ]; do
        # Skip comments and empty lines
        [[ "$line" =~ ^#.*$ ]] && continue
        [[ "$line" =~ ^[[:space:]]*$ ]] && continue
        
        # Only export if it's a valid identifier (Name=Value)
        if [[ "$line" =~ ^[a-zA-Z_][a-zA-Z0-9_]*= ]]; then
            export "$line"
        fi
    done < "$ENV_FILE"
else
    echo "⚠️  Warning: .env file not found at $ENV_FILE"
fi

echo "1. Building & Pushing Image (Cloud Build)..."
cd "$(dirname "$0")/../bots/marketing-bot"
gcloud builds submit --tag $GCR_PATH . --project $PROJECT_ID

echo "2. Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image $GCR_PATH \
  --platform managed \
  --region $REGION \
  --project $PROJECT_ID \
  --allow-unauthenticated \
  --memory 256Mi \
  --cpu 1 \
  --update-env-vars "NODE_ENV=production,REDDIT_SERVICE_URL=$REDDIT_SERVICE_URL,INTERNAL_FETCH_SECRET=$INTERNAL_FETCH_SECRET"

echo "=========================================="
echo " ✅ Bot Shipped & Deployed Successfully!"
echo "=========================================="
echo " Service URL: https://$SERVICE_NAME-917650305025.us-central1.run.app"
echo " Send a 'hi' to your bot to see the new Control Panel."
echo "=========================================="
