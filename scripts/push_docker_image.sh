#!/bin/bash

# Script to build and push Docker image with git tag version and latest

# Exit immediately if a command exits with a non-zero status
set -e

# Check if git is installed
if ! command -v git &> /dev/null;
then
    echo "Error: git is not installed or not in PATH."
    exit 1
fi

# Check if docker is installed
if ! command -v docker &> /dev/null;
then
    echo "Error: docker is not installed or not in PATH."
    exit 1
fi

# Get the current git tag
# This gets the tag pointing to the current commit, or the most recent tag reachable
TAG=$(git describe --tags --exact-match 2>/dev/null || git describe --tags --abbrev=0 2>/dev/null || echo "")

# Remove 'v' prefix if it exists from the tag
VERSION_FOR_DOCKER=$(echo "$TAG" | sed 's/^v//')

if [ -z "$TAG" ]; then
    echo "❌ Error: No git tag found."
    echo "Please tag your commit before running this script."
    echo "Example: git tag -a v2.0.0 -m \"Release v2.0.0\""
    exit 1
fi

IMAGE_NAME="rishivinkannan/flux"

echo "----------------------------------------"
echo "🚀 Starting Docker Build & Push"
echo "----------------------------------------"
echo "📍 Git Tag: $TAG"
echo "🐳 Docker Version: $VERSION_FOR_DOCKER"
echo "📦 Image: $IMAGE_NAME"
echo "----------------------------------------"

# Build the image
echo "🏗️  Building image..."
docker build -t "$IMAGE_NAME:$VERSION_FOR_DOCKER" -t "$IMAGE_NAME:latest" .

# Push the specific version tag
echo "⬆️  Pushing $IMAGE_NAME:$VERSION_FOR_DOCKER..."
docker push "$IMAGE_NAME:$VERSION_FOR_DOCKER"

# Push the latest tag
echo "⬆️  Pushing $IMAGE_NAME:latest..."
docker push "$IMAGE_NAME:latest"

echo "----------------------------------------"
echo "✅ Success! Image pushed:"
echo "   - $IMAGE_NAME:$VERSION_FOR_DOCKER"
echo "   - $IMAGE_NAME:latest"
echo "----------------------------------------"
