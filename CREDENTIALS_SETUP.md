# Credentials Setup Guide

This project requires several credentials to be configured before running. For security reasons, actual credential files are not included in the repository.

## Required Credentials

### 1. Firebase Service Account
- **File**: `utils/firebase-service-account.json`
- **Template**: `utils/firebase-service-account.template.json`
- **Instructions**: 
  1. Copy `utils/firebase-service-account.template.json` to `utils/firebase-service-account.json`
  2. Replace the placeholder values with your actual Firebase service account credentials
  3. You can get these credentials from the Firebase Console → Project Settings → Service Accounts

### 2. Petpooja API Credentials
- **File**: `test-fetch-menu.js`
- **Template**: `test-fetch-menu.template.js`
- **Instructions**:
  1. Copy `test-fetch-menu.template.js` to `test-fetch-menu.js`
  2. Replace the placeholder values with your actual Petpooja API credentials:
     - `YOUR_APP_KEY_HERE` → Your Petpooja app key
     - `YOUR_APP_SECRET_HERE` → Your Petpooja app secret
     - `YOUR_ACCESS_TOKEN_HERE` → Your Petpooja access token
     - `YOUR_REST_ID_HERE` → Your restaurant ID

### 3. Cloud Build Configuration
- **File**: `cloudbuild.yaml`
- **Template**: `cloudbuild.template.yaml`
- **Instructions**:
  1. Copy `cloudbuild.template.yaml` to `cloudbuild.yaml`
  2. Set the following environment variables in your Cloud Build configuration:
     - `DB_USER` → Your database username
     - `DB_PASSWORD` → Your database password
     - `DB_NAME` → Your database name
     - `INSTANCE_CONNECTION_NAME` → Your Cloud SQL instance connection name

## Security Notes

- Never commit actual credential files to version control
- Use environment variables for sensitive configuration
- Consider using Google Cloud Secret Manager for production deployments
- Regularly rotate your credentials

## Environment Variables

For local development, you can also use a `.env` file (already in .gitignore):

```env
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=your_db_name
JWT_SECRET=your_jwt_secret
```

## Troubleshooting

If you encounter credential-related errors:
1. Ensure all credential files are properly configured
2. Check that environment variables are set correctly
3. Verify that the `.gitignore` file excludes sensitive files
4. Make sure you're not accidentally committing credential files
