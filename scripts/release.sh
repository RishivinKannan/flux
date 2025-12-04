#!/bin/bash

# Script to bump version in package.json files, commit, and tag

set -e

if [ -z "$1" ]; then
  echo "❌ Error: No version specified."
  echo "Usage: ./release.sh <new_version>"
  echo "Example: ./release.sh 2.0.1"
  exit 1
fi

NEW_VERSION=$1

# Verify the version format (simple regex for x.y.z)
if [[ ! $NEW_VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "⚠️  Warning: Version '$NEW_VERSION' does not look like x.y.z"
  read -p "Continue anyway? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

echo "----------------------------------------"
echo "🚀 Preparing Release: v$NEW_VERSION"
echo "----------------------------------------"

# Function to update package.json version using temporary file to ensure atomic write
update_json_version() {
  local dir=$1
  local version=$2
  local pkg_file="$dir/package.json"
  
  if [ -f "$pkg_file" ]; then
    echo "📝 Updating $pkg_file to $version..."
    # Use sed to replace the version line. 
    # This assumes "version": "x.x.x" format.
    sed -i "s/\"version\": \".*\"/\"version\": \"$version\"/" "$pkg_file"
  else
    echo "⚠️  Warning: $pkg_file not found, skipping."
  fi
}

# 1. Update package.json files
update_json_version "server" "$NEW_VERSION"
update_json_version "ui" "$NEW_VERSION"

# 2. Stage changes
echo "📦 Staging changes..."
git add server/package.json ui/package.json

# 3. Commit
echo "💾 Committing version bump..."
git commit -m "chore: release v$NEW_VERSION"

# 4. Tag
echo "🏷️  Creating git tag v$NEW_VERSION..."
git tag "v$NEW_VERSION"

echo "----------------------------------------"
echo "✅ Version bumped to v$NEW_VERSION"
echo "----------------------------------------"
echo "Next steps:"
echo "1. Push changes:    git push && git push --tags"
echo "2. Build Docker:    ./push_docker_image.sh"
echo "----------------------------------------"
