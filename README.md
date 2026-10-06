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

### CMS login and publishing

The migrated CMS uses Cloudflare Access email one-time codes, not Netlify
Identity or GitHub accounts for editors. Open https://amwellvalley.pages.dev/admin/,
enter an authorized email, enter the code from your inbox, and select
**Continue with email**. Edit the page and click **Publish**. A commit on `main`
starts the `Publish Cloudflare Pages` GitHub Actions workflow. Allow a few
minutes for the build; check Actions if a published change has not appeared.

The publishing bridge only writes the eight CMS pages, `data/settings.toml`,
and approved media file types under `static/images`. It verifies Access JWT
signatures, issuer, audience, expiration, and the editor email on every API
request. Editors cannot change application code or deployment workflows.

The production CMS is configured as follows:

1. A Cloudflare Access self-hosted application for `amwellvalley.pages.dev/admin`
   and `amwellvalley.pages.dev/api`, using email one-time PIN login. Allow only
   `alfredo@h7marketing.com` and `yogaboy27@mac.com`. Use the same application
   for both paths, so the login session works for CMS saves. Do not protect
   the entire public website with this application.
2. Production Pages variables `CF_ACCESS_TEAM_DOMAIN` (the team's
   `*.cloudflareaccess.com` hostname, without a scheme) and `CF_ACCESS_AUD`
   (the application's audience tag). The team hostname is
   `mute-poetry-6b50.cloudflareaccess.com`.
3. Production Pages secret `CMS_GITHUB_TOKEN`: a fine-grained GitHub token
   limited to `alfredoh7/one-click-hugo-cms-f7fbf`, Contents read/write and
   the required Metadata read permission. No Actions, Workflows, or account
   administration permissions. Track its expiration and rotate before expiry.
   The initial CMS token expires October 6, 2027.
4. GitHub Actions repository secret `CLOUDFLARE_API_TOKEN`: Cloudflare Pages
   Edit permission for account `b892002889aff98a6879404b0e4e8222`.
5. Deploy and test both email login and a CMS save. Verify the GitHub Actions
   run succeeds and `/deployment.json` contains the published commit.

Never commit tokens or user passwords. The GitHub publishing token stays
server-side; the CMS browser stores only a non-secret session marker.
Missing configuration fails closed with HTTP 503 rather than exposing saves.
Unsigned, expired, or unauthorized sessions are rejected. Access should also
protect preview deployment URLs, and preview environments must not inherit
production publishing secrets.

Cloudflare rejected native Git integration with error 8000011, so automatic
publishing uses GitHub Actions with direct upload to the existing Pages
project. A failed workflow leaves the previous production deployment intact.

The existing browser password prompt is retained as requested. It is a
client-side convenience gate, not server-side protection for private data.

## Local development

1. Install Hugo if it is not already available on your machine.
2. Run `hugo server`.
3. Open the local URL Hugo prints in your terminal to preview the site.

## Authentication Maintenance

To add another editor, update both the Access application's email allowlist
and the `EDITORS` allowlist in `lib/cms-email.mjs`, then deploy. Email codes
replace the old Netlify password and invitations. To revoke an editor, remove
their email from both allowlists and revoke their Access sessions.

Run `npm ci` and `node --test tests/cms-auth.test.mjs` before deploying changes
to the publishing bridge. Keep Netlify available until the replacement login
and publishing flow have been verified; the migrated frontend does not call
Netlify Identity or Git Gateway.

## Project structure

- `content/`: editable page content
- `data/settings.toml`: site-wide settings managed through the CMS
- `layouts/`: Hugo templates and partials
- `static/admin/`: Decap CMS entry point and config
- `static/css/style.css`: site styling
- `static/images/` and `static/files/`: migrated site assets and downloads
