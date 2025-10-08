# GitHub Pages Deployment Guide

## Step-by-Step Instructions

### 1. Initialize Git Repository (if not already done)

```bash
git init
git add .
git commit -m "Initial commit - production-ready queue system"
```

### 2. Create GitHub Repository

1. Go to [GitHub](https://github.com) and create a new repository named `ADASayembara`
2. **Do NOT** initialize with README, .gitignore, or license (you already have these)

### 3. Push to GitHub

```bash
git remote add origin https://github.com/YOUR_USERNAME/ADASayembara.git
git branch -M main
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

### 4. Add Environment Variables as GitHub Secrets

1. Go to your repository on GitHub
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add these three secrets:

   - Name: `REACT_APP_SUPABASE_URL`
     Value: `https://xxxxx.supabase.co`

   - Name: `REACT_APP_SUPABASE_ANON_KEY`
     Value: `your_supabase_anon_key`

   - Name: `REACT_APP_ADMIN_PASSWORD`
     Value: `your_secure_admin_password`

### 5. Enable GitHub Pages

1. Go to **Settings** → **Pages**
2. Under **Source**, select **GitHub Actions**
3. Click **Save**

### 6. Trigger Deployment

The deployment will automatically trigger when you push to `main`. To trigger manually:

```bash
git add .
git commit -m "Deploy to GitHub Pages"
git push
```

Or go to **Actions** tab → **Deploy to GitHub Pages** → **Run workflow**

### 7. Access Your Site

After deployment completes (2-3 minutes), your site will be available at:

```
https://YOUR_USERNAME.github.io/ADASayembara/
```

## Important Configuration Notes

### Base URL Configuration

In `vite.config.js`, the base URL is set to `/ADASayembara/`:

```js
base: '/ADASayembara/',
```

**If your repository name is different**, update this line to match your repo name.

### For Custom Domain

If you want to use a custom domain (e.g., `queue.yourdomain.com`):

1. Create a `CNAME` file in the `public/` folder:
   ```
   queue.yourdomain.com
   ```

2. Update `vite.config.js`:
   ```js
   base: '/',  // Change from '/ADASayembara/' to '/'
   ```

3. Add DNS records at your domain provider:
   - Type: `CNAME`
   - Name: `queue` (or `@` for root domain)
   - Value: `YOUR_USERNAME.github.io`

4. Go to GitHub **Settings** → **Pages** → **Custom domain**
5. Enter your custom domain and save

## Troubleshooting

### Site shows blank page
- Check the `base` URL in `vite.config.js` matches your repository name
- Verify the workflow completed successfully in Actions tab
- Check browser console for errors

### Environment variables not working
- Verify secrets are added correctly in GitHub Settings → Secrets
- Check secret names match exactly (case-sensitive)
- Re-run the workflow after adding secrets

### Build fails
- Check the workflow logs in the Actions tab
- Verify `package.json` has all required dependencies
- Ensure `npm ci` can install packages successfully

### 404 errors on refresh
This is expected for SPAs on GitHub Pages. To fix:

1. Create `public/404.html`:
```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Redirecting...</title>
    <script>
      sessionStorage.redirect = location.href;
    </script>
    <meta http-equiv="refresh" content="0;URL='/ADASayembara/'">
  </head>
  <body></body>
</html>
```

2. Add to `index.html` inside `<head>`:
```html
<script>
  const redirect = sessionStorage.redirect;
  delete sessionStorage.redirect;
  if (redirect && redirect !== location.href) {
    history.replaceState(null, null, redirect);
  }
</script>
```

## Updating Your Site

Every time you push to `main`, GitHub Actions will automatically rebuild and redeploy:

```bash
# Make changes to your code
git add .
git commit -m "Update feature X"
git push
```

## Manual Build (Optional)

To test the production build locally:

```bash
npm run build
npm run preview
```

This will build and serve the production site at `http://localhost:4173`

## Monitoring Deployments

1. Go to the **Actions** tab in your GitHub repository
2. Click on the latest workflow run
3. Monitor the build and deploy steps
4. Check for any errors in the logs

## Security Notes

- Never commit `.env` file (it's in `.gitignore`)
- Keep GitHub secrets secure
- Rotate credentials if compromised
- Use strong admin password
- Monitor repository access

## Cost

GitHub Pages is **completely free** for:
- Public repositories (unlimited)
- Private repositories (with some limits)

No credit card required!

## Next Steps After Deployment

1. Share the URL: `https://YOUR_USERNAME.github.io/ADASayembara/`
2. Generate QR code for easy access
3. Test on mobile devices
4. Monitor Supabase usage in dashboard
5. Set up Supabase auth if needed

## Support

If deployment fails, check:
- GitHub Actions logs for errors
- Supabase dashboard for API issues
- Browser console for runtime errors

For further help, open an issue in the repository.
