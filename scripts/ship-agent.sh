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

echo "1. Building & Pushing Image (Cloud Build)..."
cd bots/marketing-bot
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
  --update-env-vars "NODE_ENV=production"

echo "=========================================="
echo " ✅ Bot Shipped & Deployed Successfully!"
echo "=========================================="
echo " Service URL: https://$SERVICE_NAME-917650305025.us-central1.run.app"
echo " Send a 'hi' to your bot to see the new Control Panel."
echo "=========================================="
