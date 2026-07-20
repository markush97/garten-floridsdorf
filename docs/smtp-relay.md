# Self-hosted SMTP relay

Cloudflare Workers can't open arbitrary outbound TCP and they
explicitly block port 25, so the Worker hands outbound mail to a
small HTTP service running on the same Docker network as Mailcow.
That service then speaks SMTP to Mailcow's submission port (587).

We use the existing [`smtprelay`](https://github.com/decke/smtprelay)
container — single binary, single config, no code to maintain.

## Architecture

```
Worker (Cloudflare)                  Mailcow host (docker compose)
┌──────────────┐                     ┌──────────────────────────┐
│ sendMagicLink│  POST /send         │ nginx  (TLS, CF-IP list) │
│   Email()    │  Bearer <token> ─▶ │  ↓                       │
│              │                     │ smtprelay  :8080         │
└──────────────┘                     │  ↓ SMTP AUTH             │
                                     │ Mailcow  :587            │
                                     └──────────────────────────┘
```

## 1. Run `smtprelay` on the Mailcow host

Add a service to the `docker-compose.override.yml` that ships next
to Mailcow. It joins the same network so it can reach Mailcow by
container name.

```yaml
# docker-compose.override.yml  (next to mailcow-dockerized docker-compose.yml)
services:
  smtprelay:
    image: decke/smtprelay:latest
    container_name: mailcow-smtprelay
    restart: unless-stopped
    networks:
      - mailcowdockerized_mailcow-network
    environment:
      # Reachable from Mailcow by its service name.
      SMTP_RELAY_HOST: postfix
      SMTP_RELAY_PORT: "587"
      SMTP_RELAY_USERNAME: anmeldung@beetbewegung.at
      SMTP_RELAY_PASSWORD: ${ANMELDUNG_SMTP_PASSWORD}
      SMTP_RELAY_ALLOWED_AUTH: "mailcow-anmeldung"
      LISTEN: ":8080"
      # `smtprelay` has two HTTP modes:
      #   - "none"        no auth on the HTTP side (don't use)
      #   - "mailcow-anmeldung"  basic auth, single user
      # For our use we want a bearer token, not basic auth. We
      # therefore put a Cloudflare-Authenticated-Origins-style
      # shared secret in the header and validate it via nginx.
      # Either pick the mode you like best; "mailcow-anmeldung"
      # is the simplest match for what smtprelay supports.
      HTTP_ALLOWED_DOMAINS: ""
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:8080/health"]
      interval: 30s
      timeout: 5s
      retries: 3
```

> If you'd rather not rely on `smtprelay`'s built-in HTTP auth,
> terminate TLS + auth at nginx and let `smtprelay` listen only on
> `127.0.0.1`. That's the setup below.

## 2. nginx vhost (TLS + shared-secret header)

Only Cloudflare's egress IPs may hit the endpoint. Pull the list
from <https://www.cloudflare.com/ips/> and refresh quarterly.

```nginx
# /etc/nginx/sites-available/smtp-relay.conf
upstream smtprelay_upstream {
  server 127.0.0.1:8080;
  keepalive 16;
}

# /etc/nginx/cloudflare-ips.conf — populate with the CF IPv4 + IPv6
# CIDRs from https://www.cloudflare.com/ips/

server {
  listen 443 ssl http2;
  server_name mail-relay.beetbewegung.at;

  ssl_certificate     /etc/letsencrypt/live/mail-relay.beetbewegung.at/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/mail-relay.beetbewegung.at/privkey.pem;

  location = /send {
    include /etc/nginx/cloudflare-ips.conf;
    deny all;

    # Shared-secret header. Must match SMTP_RELAY_TOKEN in
    # Cloudflare Worker → Settings → Variables and Secrets.
    if ($http_x_smtp_token != "PUT-A-LONG-RANDOM-HERE") {
      return 403;
    }

    proxy_pass http://smtprelay_upstream/send;
    proxy_set_header Host $host;
    proxy_read_timeout 30s;
    proxy_request_buffering off;
  }

  # smtprelay exposes a /health endpoint; use it for monitoring.
  location = /health {
    proxy_pass http://smtprelay_upstream/health;
  }
}
```

### smtprelay config (minimal)

`smtprelay` reads its config from env vars. With the vhost above
handling auth and TLS, you can let it bind to localhost only:

```yaml
# updated service in docker-compose.override.yml
smtprelay:
  image: decke/smtprelay:latest
  container_name: mailcow-smtprelay
  restart: unless-stopped
  networks:
    - mailcowdockerized_mailcow-network
  environment:
    SMTP_RELAY_HOST: postfix
    SMTP_RELAY_PORT: "587"
    SMTP_RELAY_USERNAME: anmeldung@beetbewegung.at
    SMTP_RELAY_PASSWORD: ${ANMELDUNG_SMTP_PASSWORD}
    LISTEN: 127.0.0.1:8080
```

## 3. DNS records needed on `beetbewegung.at`

`smtprelay` only relays — Mailcow still has to look like a legitimate
sender. Confirm these are present and valid:

- `A` for `mail-relay.beetbewegung.at` → server IP
- `A`/`AAAA` for `mail.beetbewegung.at` → server IP (Mailcow itself)
- `MX` for `beetbewegung.at` → `10 mail.beetbewegung.at.`
- `TXT` for `beetbewegung.at` → `v=spf1 mx -all`
- DKIM key (`default._domainkey.beetbewegung.at`)
- `TXT` for `_dmarc.beetbewegung.at` → `v=DMARC1; p=quarantine; rua=mailto:…`

Mailcow's "Domains" panel shows whether DKIM/SPF/DMARC are passing.

## 4. Cloudflare Worker configuration

Set the URL and the matching token on each environment.

```bash
pnpm wrangler secret put SMTP_RELAY_URL   --env production
pnpm wrangler secret put SMTP_RELAY_TOKEN --env production
```

`SMTP_RELAY_URL` is the public nginx URL (e.g.
`https://mail-relay.beetbewegung.at`). `SMTP_RELAY_TOKEN` is the
shared secret that nginx checks.

`EMAIL_FROM` is optional; the Worker defaults to
`SV Beet & Bewegung <anmeldung@beetbewegung.at>`.

For local dev the values come from `.dev.vars` (`pnpm dev` picks
them up automatically); with no relay configured the Worker logs
the mail body to the console instead of sending.

## 5. Request protocol (for reference)

The Worker calls:

```
POST /send
X-SMTP-Token: <SMTP_RELAY_TOKEN>
Content-Type: application/json

{
  "from":    "SV Beet & Bewegung <anmeldung@beetbewegung.at>",
  "to":      "user@example.com",
  "subject": "Dein Anmeldelink",
  "text":    "Mit diesem Link meldest du dich an: ..."
}
```

Status codes:

| Status | Meaning |
| ------ | ------- |
| `2xx`  | Mail handed off. |
| `4xx`  | Bad payload (missing field, malformed address). |
| `5xx`  | `smtprelay` or Mailcow upstream failure — retry later. |

## 6. Test the chain end-to-end

```bash
# 1. From the Worker host, hit the relay through nginx
curl -sS -X POST https://mail-relay.beetbewegung.at/send \
  -H "X-SMTP-Token: $SMTP_RELAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"from":"SV Beet & Bewegung <anmeldung@beetbewegung.at>",
        "to":"you@gmail.com",
        "subject":"smoke test",
        "text":"hi from the relay"}'

# 2. Watch Mailcow's mail log
docker compose logs -f postfix-mailcow

# 3. Trigger a real magic link from the deployed app, then
#    tail the Worker logs for "[email] mail to …"
```

## Alternatives

- **`go-smtp-forward`** — same shape, smaller binary, similar env config.
- **A Python `aiosmtplib` + `aiohttp` sidecar** — flexible but more code to maintain.
- **`mailcow-forward-email` plugin** — Mailcow's own forwarding rules, but no built-in HTTP endpoint; you still need a bridge.

`sendeRmailay` ships with most distros, has zero deps, and is what
we'd reach for first when a tool just needs to glue two ports
together.