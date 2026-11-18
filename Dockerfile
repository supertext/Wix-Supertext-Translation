# Supertext Translation for Wix: the app backend (runs on Railway).
FROM node:26-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci && npm cache clean --force

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
COPY public ./public
RUN npm run build && npm prune --omit=dev

ENV NODE_ENV=production
EXPOSE 8080
# Creates its database on the shared Postgres server if needed, then serves the dashboard pages.
CMD ["node", "dist/server.js"]
