# GitHub OAuth Setup Guide

## What Are These Secrets?

These three secrets are used for **authentication and authorization** in your Data Deals application:

### 1. `GITHUB_CLIENT_ID` & `GITHUB_CLIENT_SECRET`
**Purpose**: Enable users to sign in with their GitHub account

- **What it does**: Allows your app to authenticate users via GitHub OAuth
- **How it works**: When users click "Sign In" or try to access `/admin`, they're redirected to GitHub to authorize your app, then redirected back
- **Used by**: NextAuth.js (authentication library)

### 2. `ADMIN_GITHUB_USERNAMES`
**Purpose**: Controls who has admin access to approve/reject suggestions

- **What it does**: Defines which GitHub usernames can access the `/admin` dashboard
- **How it works**: When a user signs in, their GitHub username is checked against this list
- **Format**: Comma-separated list (e.g., `"luis-oala,another-admin"`)
- **Used by**: Admin dashboard and API routes for authorization

## Why Do You Need Them?

Your application has an **Admin Dashboard** (`/admin`) where admins can:
- Review pending suggestions from users
- Approve or reject edits/new entries
- Manage the data deals database

To access this dashboard, users must:
1. Sign in with GitHub (requires `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`)
2. Have their username in the admin list (requires `ADMIN_GITHUB_USERNAMES`)

## How to Get Them

### Step 1: Create a GitHub OAuth App

1. Go to GitHub → **Settings** → **Developer settings**
   - Direct link: https://github.com/settings/developers

2. Click **OAuth Apps** → **New OAuth App**

3. Fill in the form:
   - **Application name**: `Data Deals` (or any name you prefer)
   - **Homepage URL**: `http://<your-ec2-ip>` or your domain
   - **Authorization callback URL**: 
     - For EC2: `http://<your-ec2-ip>/api/auth/callback/github`
     - For domain: `https://your-domain.com/api/auth/callback/github`
     - Example: `http://54.123.45.67/api/auth/callback/github`

4. Click **Register application**

5. **Copy the credentials**:
   - **Client ID**: Shown immediately (copy this)
   - **Client Secret**: Click **Generate a new client secret** → Copy it (you can only see it once!)

### Step 2: Add to GitHub Secrets

Go to your repository → **Settings** → **Secrets and variables** → **Actions**

Add these secrets:

1. **`OAUTH_CLIENT_ID`** ⚠️ 
   - **Important**: GitHub doesn't allow secret names starting with `GITHUB_`
   - Name: `OAUTH_CLIENT_ID` (not `GITHUB_CLIENT_ID`)
   - Value: The Client ID from Step 1

2. **`OAUTH_CLIENT_SECRET`** ⚠️
   - **Important**: GitHub doesn't allow secret names starting with `GITHUB_`
   - Name: `OAUTH_CLIENT_SECRET` (not `GITHUB_CLIENT_SECRET`)
   - Value: The Client Secret from Step 1

3. **`ADMIN_GITHUB_USERNAMES`**
   - Value: Your GitHub username (and any other admins)
   - Format: `your-username` or `user1,user2,user3`
   - Example: `luis-oala`

### Step 3: Update Callback URL After Deployment

After your first deployment, you'll know your EC2 IP or domain. Update the OAuth app:

1. Go back to GitHub → **Settings** → **Developer settings** → **OAuth Apps**
2. Click on your app
3. Update **Authorization callback URL** to match your actual URL:
   - `http://<your-actual-ec2-ip>/api/auth/callback/github`

## How It Works in Your App

### Authentication Flow

1. User visits `/admin` or clicks "Sign In"
2. They're redirected to GitHub to authorize
3. GitHub redirects back to your app with an authorization code
4. NextAuth.js exchanges the code for user info
5. User's GitHub username is checked against `ADMIN_GITHUB_USERNAMES`
6. If match → Admin access granted ✅
7. If no match → "Unauthorized" message ❌

### Code Reference

**Authentication** (`lib/auth.ts`):
```typescript
GitHubProvider({
  clientId: process.env.GITHUB_CLIENT_ID!,
  clientSecret: process.env.GITHUB_CLIENT_SECRET!,
})
```

**Admin Check** (`lib/auth.ts`):
```typescript
const adminUsernames = (process.env.ADMIN_GITHUB_USERNAMES || '')
  .split(',')
  .map(u => u.trim())
token.isAdmin = adminUsernames.includes(profile.login)
```

## Troubleshooting

### "Invalid client" error
- Check that `OAUTH_CLIENT_ID` and `OAUTH_CLIENT_SECRET` secrets are set correctly
- Verify the values match your GitHub OAuth App credentials
- Verify callback URL matches exactly (including `http://` vs `https://`)

### "Secret names must not start with GITHUB_" error
- GitHub Actions reserves secrets starting with `GITHUB_` for internal use
- Use `OAUTH_CLIENT_ID` and `OAUTH_CLIENT_SECRET` instead
- The workflow automatically maps these to `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in the `.env` file

### "Unauthorized" after signing in
- Check that your GitHub username is in `ADMIN_GITHUB_USERNAMES`
- Username is case-sensitive
- Check for typos or extra spaces

### Callback URL mismatch
- The callback URL in GitHub OAuth app must match your `NEXTAUTH_URL`
- Format: `<NEXTAUTH_URL>/api/auth/callback/github`
- Example: If `NEXTAUTH_URL=http://54.123.45.67`, callback should be `http://54.123.45.67/api/auth/callback/github`

## Security Notes

- **Never commit** these values to your repository
- Use GitHub Secrets for deployment
- Rotate `GITHUB_CLIENT_SECRET` periodically
- Only add trusted GitHub usernames to `ADMIN_GITHUB_USERNAMES`
- Consider using environment-specific OAuth apps (dev vs prod)

## Quick Checklist

- [ ] Created GitHub OAuth App
- [ ] Copied Client ID
- [ ] Generated and copied Client Secret
- [ ] Added `OAUTH_CLIENT_ID` to GitHub Secrets (⚠️ not `GITHUB_CLIENT_ID`)
- [ ] Added `OAUTH_CLIENT_SECRET` to GitHub Secrets (⚠️ not `GITHUB_CLIENT_SECRET`)
- [ ] Added `ADMIN_GITHUB_USERNAMES` to GitHub Secrets
- [ ] Updated callback URL after first deployment
- [ ] Tested sign-in flow
- [ ] Verified admin access works

