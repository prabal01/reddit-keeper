#!/bin/bash
# deploy-redis.sh
# 
# This script provisions an e2-micro VM on GCP and opens port 6379 for your Redis server.
#
# Prerequisite: You must be authenticated with Google Cloud CLI.
# Run `gcloud auth login` and `gcloud config set project YOUR_PROJECT_ID` before running this.

# Variables (Change these if necessary)
INSTANCE_NAME="opiniondeck-redis"
ZONE="us-east1-c"    # Changed from us-east1-b due to resource exhaustion
MACHINE_TYPE="e2-micro" # Free tier eligible in some regions, very cheap otherwise
IMAGE_FAMILY="ubuntu-2404-lts-amd64"
IMAGE_PROJECT="ubuntu-os-cloud"

echo "=========================================="
echo " Deploying Redis VM on GCP: $INSTANCE_NAME"
echo "=========================================="

echo "1. Creating the Compute Engine Instance..."
gcloud compute instances create $INSTANCE_NAME \
    --zone=$ZONE \
    --machine-type=$MACHINE_TYPE \
    --image-family=$IMAGE_FAMILY \
    --image-project=$IMAGE_PROJECT \
    --tags=redis-server \
    --boot-disk-size=10GB \
    --boot-disk-type=pd-standard

echo "2. Creating Firewall Rule (allow-redis-6379)..."
# In a fully production setup, we would restrict --source-ranges to the static IP of your Cloud Run NAT.
# Since we are using a strong password, we can temporarily allow 0.0.0.0/0 to ensure connectivity.
gcloud compute firewall-rules create allow-redis-6379 \
    --direction=INGRESS \
    --priority=1000 \
    --network=default \
    --action=ALLOW \
    --rules=tcp:6379 \
    --source-ranges=0.0.0.0/0 \
    --target-tags=redis-server

echo "=========================================="
echo " VM Provisioned Successfully!"
echo " Next Steps:"
echo " 1. Get the External IP of the instance:"
echo "    gcloud compute instances describe $INSTANCE_NAME --zone=$ZONE --format='get(networkInterfaces[0].accessConfigs[0].natIP)'"
echo " 2. SSH into the instance to install Docker and start Redis:"
echo "    gcloud compute ssh $INSTANCE_NAME --zone=$ZONE"
echo "=========================================="
