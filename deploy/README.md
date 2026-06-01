# Deploy — self-hosted on the VPS

GamePlan runs as a Next.js **standalone** server on `127.0.0.1:3473`, managed by
systemd, reverse-proxied by Apache, with TLS from certbot.

**Live at `https://gameplan.stephens.page`** (cut over 2026-06-01 — the legacy PHP
app was replaced in place). The previous vhosts are backed up at
`/etc/apache2/sites-available/gameplan.stephens.page*.conf.legacy-bak`; restore
those + `systemctl reload apache2` to roll back. The legacy app dir
(`/var/www/gameplan.stephens.page`) and the unused `api.gameplan.stephens.page`
vhost are still present but no longer served — retire when ready.

### Reverse-proxy requirements (learned in prod)
- The `:443` vhost must send **`RequestHeader set X-Forwarded-Proto "https"`** and
  `ProxyPreserveHost On`, so Auth.js sets `__Secure-` cookies and https URLs.
- **`AUTH_URL` must be pinned** in `.env` to the public origin. Without it Auth.js
  infers `127.0.0.1:3473` and login redirects to a dead localhost URL.

Database: Postgres `game_planning` on the on-volume PG16 cluster (creds in
`.env`, gitignored). Build-is-deploy: rebuild → restart.

## One-time setup

1. **DNS** — add an A record for the chosen subdomain → `68.183.62.24`
   (e.g. `gameplan2.stephens.page`). Verify: `dig +short @8.8.8.8 <host>`.

2. **systemd service**
   ```sh
   sudo cp deploy/gameplan-web.service /etc/systemd/system/gameplan-web.service
   sudo systemctl daemon-reload
   deploy/deploy.sh                 # builds + stages, then restarts
   sudo systemctl enable gameplan-web
   curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3473/login   # expect 200
   ```

3. **Apache vhost + TLS** (after DNS resolves)
   ```sh
   sed 's/GAMEPLAN_HOST/<host>/' deploy/apache-vhost.conf | sudo tee /etc/apache2/sites-available/<host>.conf
   sudo a2ensite <host>.conf
   sudo apache2ctl configtest && sudo systemctl reload apache2
   sudo certbot --apache -d <host> --non-interactive --redirect
   ```
   (Requires `proxy` + `proxy_http` modules: `sudo a2enmod proxy proxy_http`.)

4. **Production env** — set a real `AUTH_SECRET` (already generated) and, to enable
   the admin sign-up email, `RESEND_API_KEY` + `ADMIN_EMAIL` in `.env`.

## Recurring deploy

```sh
deploy/deploy.sh
```

## Cutover (when ready to replace the legacy app)

Point `gameplan.stephens.page` at this service (swap its vhost `DocumentRoot`
for the same `ProxyPass` block, re-run certbot if needed), and retire the PHP
`gameplan.stephens.page` + `api.gameplan.stephens.page` vhosts. Note the legacy
data lived in a separate MySQL DB — migrate rows first if they must be preserved.
