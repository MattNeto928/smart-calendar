#!/bin/bash

# Set Node options for increased memory
export NODE_OPTIONS="--max-old-space-size=8192"

# Create the bundle directory if it doesn't exist
mkdir -p main.jsbundle

# Install required dependencies
cd .. && npm install --legacy-peer-deps

# Generate the iOS bundle
cd ios && npx expo export:embed \
  --platform ios \
  --dev false \
  --bundle-output ./main.jsbundle/main.jsbundle \
  --assets-dest ./main.jsbundle \
  --verbose

echo "Bundle created successfully at main.jsbundle/main.jsbundle"
