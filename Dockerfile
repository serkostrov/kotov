# syntax=docker/dockerfile:1

# --- build SPA (VITE_* optional here; Dokploy injects them at runtime via env.js) ---
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Optional build-time bake (local docker compose). Dokploy usually uses runtime Environment.
ARG VITE_SUPABASE_URL=
ARG VITE_SUPABASE_ANON_KEY=
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

RUN npm run build

# --- static nginx ---
FROM nginx:1.27-alpine AS production

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh \
  && printf '%s\n' 'ok' > /usr/share/nginx/html/healthz

EXPOSE 80

ENV VITE_SUPABASE_URL="" \
    VITE_SUPABASE_ANON_KEY=""

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz >/dev/null || exit 1

ENTRYPOINT ["/entrypoint.sh"]
