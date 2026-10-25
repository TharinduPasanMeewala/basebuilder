# Host the BaseBuilder frontend

This repository can run on localhost or a server under your own domain.
Authentication, projects, AI connections and backend functions remain on Base44.
An internet connection and access to the existing Base44 app are required; this is not an offline migration of its backend.

## Local development

Install Node.js 22 or newer. Copy .env.example to .env and keep the app ID:
6a2a34f6f3a1ed50ecd8de02

    npm install
    npm run dev

Open the URL printed by Vite. The Vite API proxy forwards /api requests to the fixed Base44 backend.
Use your existing app account. Redirect-based OAuth login requires a redirect configuration that matches your hosting URL.

## Local production build

    npm run build
    npm start

Open http://localhost:3000. The production server includes SPA deep-link routing and a fixed Base44 API proxy.
The default bind address is 127.0.0.1. Set HOST=0.0.0.0 only when you want external access; choose a port with PORT.
The server forwards the signed-in user's API authorization, and does not require or embed a service-role token.

## Docker on localhost

    docker compose up --build -d app

Open http://localhost:3000. The Docker build sets the public Base44 app ID.
API keys and app secrets remain on Base44 and are excluded by .dockerignore.

## Your own domain

1. Point a domain you control to the server's public address.
2. Replace builder.example.com in hosting/Caddyfile with that domain.
3. Open inbound TCP ports 80 and 443 and install Docker with the Compose plugin.
4. Run:

    docker compose --profile domain up --build -d

Caddy obtains and renews a certificate when DNS reaches your server.
Check status with docker compose ps and logs with docker compose logs --tail=100 app caddy.
Keep Caddy's data volumes to preserve certificates.

## Generated applications

Inside the builder, choose Project → Hosting to download a separate generated-app ZIP.
That package includes HOSTING.md, a local production server, Docker, a custom-domain profile and static-host rewrites.
Generated record screens use browser-local storage. It does not export the builder's Base44 backend, accounts, credentials or cloud workflows.
The source package is editable in Project → Studio → Code editor.

## Verification

    npm run lint
    npm run test:features
    npm run build
    npm run test:exports

test:exports installs dependencies only in a temporary directory and checks two generated builds and the local production server.
Paid provider calls need your provider key and model access. Use Settings → Test connection after saving a connection.
Local model servers need an authenticated HTTPS gateway to be reachable by the Base44-hosted AI gateway.
