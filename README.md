# Amwell Valley Conservancy

This project rebuilds the Amwell Valley Conservancy site as a Hugo static site with Decap CMS and Netlify-ready configuration.

## Local development

1. Install Hugo if it is not already available on your machine.
2. Run `hugo server`.
3. Open the local URL Hugo prints in your terminal to preview the site.

## Deployment and CMS setup

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

