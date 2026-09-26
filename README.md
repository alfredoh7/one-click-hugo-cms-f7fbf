# Amwell Valley Conservancy

Amwell Valley Conservancy is a Hugo static site hosted on Cloudflare Pages at
https://amwellvalley.pages.dev/.

## Cloudflare Pages deployment

The source repository is https://github.com/alfredoh7/one-click-hugo-cms-f7fbf,
on branch `main`. Always pull current CMS edits before building.

1. Run `git pull --ff-only` in the repository checkout.
2. Authenticate with `npx --yes wrangler@4.141.0 login` if needed.
3. Run `npm run deploy:cloudflare` to build Hugo and publish to the
   `amwellvalley` Pages project.
4. Verify https://amwellvalley.pages.dev/ and its calendar and staff details.

The existing `amwellvalley` project uses Pages, not Workers.
The public site, images, documents, and existing browser password gate are
served by Cloudflare. `netlify.toml` is retained for the legacy deployment.

### CMS and automatic deployment status

The CMS is at https://amwellvalley.pages.dev/admin/ and currently retains
Netlify Identity and Git Gateway for the existing editor accounts. Its API
URLs explicitly point to the original Netlify site. These services are
separate from public website hosting.

As of 2026-09-27, Netlify returns HTTP 503 `usage_exceeded` for both the
original site and Identity. CMS login and publishing cannot work until that
service is restored or a replacement authentication backend is configured.
Do not delete the Netlify project while it owns editor accounts.

Cloudflare rejected Git integration with error 8000011 (an internal Git
installation issue), so this is a direct-upload Pages project. GitHub pushes
and CMS saves do not automatically publish to Cloudflare. Run the deployment
command above after edits. Automatic publishing needs a CI deployment setup
with a Cloudflare Pages deployment token stored as a repository secret.
Never commit tokens or user passwords to the repository.

The existing browser password prompt is retained as requested. It is a
client-side convenience gate, not server-side protection for private data.

## Local development

1. Install Hugo if it is not already available on your machine.
2. Run `hugo server`.
3. Open the local URL Hugo prints in your terminal to preview the site.

## Legacy Netlify CMS setup

1. Push the repo to GitHub.
2. Connect the repo to Netlify.
3. Enable Netlify Identity in the Netlify dashboard under `Identity`.
4. Enable Git Gateway under `Identity > Services`.
5. Invite your admin user through Netlify Identity.
6. Access the CMS at `https://[your-netlify-domain]/admin`.
7. Run `hugo server` locally any time you want to preview changes before pushing.

## Project structure

- `content/`: editable page content
- `data/settings.toml`: site-wide settings managed through the CMS
- `layouts/`: Hugo templates and partials
- `static/admin/`: Decap CMS entry point and config
- `static/css/style.css`: site styling
- `static/images/` and `static/files/`: migrated site assets and downloads
