# ding-mvp
Ding MVP

## Deployment Instructions

### Automated Deployment (Recommended)

1. Set up environment variables:
   ```bash
   export CPANEL_USER="your_cpanel_username"
   export CPANEL_PASS="your_cpanel_password"
   export CPANEL_HOST="your_cpanel_host"
   ```

2. Install required tools:
   ```bash
   # For macOS
   brew install lftp
   
   # For Ubuntu/Debian
   sudo apt-get install lftp
   ```

3. Run the deployment script:
   ```bash
   chmod +x deploy.sh
   ./deploy.sh
   ```

4. Complete the remaining steps in CPanel:
   - Extract the uploaded zip file
   - Run NPM Install
   - Apply any database migrations

### Manual Deployment Steps

#### Frontend Deployment (ding-mvp-frontend)

1. Update API endpoint:
   - Modify the endpoint in `apiClient.js` from `http:localhost:5010/api` to `https:myding.in/api`

2. Build the application:
   ```bash
   npm run build
   ```

3. Deploy to CPanel:
   - Upload the build files directly to the `public_html` directory in CPanel

#### Backend Deployment (ding-mvp)

1. Clean up:
   ```bash
   rm -r node_modules  # Remove node_modules to save space
   ```

2. Deploy to server:
   - Upload the entire ding-mvp directory to the root (/) of the server

3. Install dependencies:
   - Navigate to the Node JS Apps page in CPanel
   - Click "Run NPM Install"

4. Database updates:
   - Run any necessary SQL queries if new tables have been added or existing tables have been modified.
