#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Starting deployment process...${NC}"

# Frontend Deployment
echo -e "${GREEN}Deploying Frontend...${NC}"
cd ../ding-mvp-frontend

# Update API endpoint in apiClient.js
echo "Updating API endpoint..."
sed -i '' 's|http:localhost:5010/api|https:myding.in/api|g' src/apiClient.js

# Build the application
echo "Building frontend..."
npm run build

# Upload to CPanel (requires lftp to be installed)
echo "Uploading to CPanel..."
lftp -c "
  set ssl:verify-certificate no;
  open ftp://$CPANEL_USER:$CPANEL_PASS@$CPANEL_HOST;
  mirror -R build/ public_html/;
  quit;
"

# Backend Deployment
echo -e "${GREEN}Deploying Backend...${NC}"
cd ../ding-mvp

# Clean up
echo "Cleaning up..."
rm -rf node_modules
rm -f package-lock.json

# Create deployment package
echo "Creating deployment package..."
zip -r ../ding-mvp-deploy.zip . -x "*.git*" "node_modules/*" "*.DS_Store"

# Upload to server (requires lftp to be installed)
echo "Uploading to server..."
lftp -c "
  set ssl:verify-certificate no;
  open ftp://$CPANEL_USER:$CPANEL_PASS@$CPANEL_HOST;
  put ../ding-mvp-deploy.zip;
  quit;
"

# Clean up deployment package
rm ../ding-mvp-deploy.zip

echo -e "${GREEN}Deployment package created and uploaded!${NC}"
echo -e "${BLUE}Next steps:${NC}"
echo "1. Login to CPanel"
echo "2. Extract ding-mvp-deploy.zip to root directory"
echo "3. Click 'Run NPM Install' on the Node JS Apps page"
echo "4. Run any necessary database migrations" 