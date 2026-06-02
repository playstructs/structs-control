# structs-control — multi-target image for dev (webpack HMR) and prod (nginx static).

# Shared base: dependencies + source (runs standalone without a bind mount).
FROM node:22-bookworm AS base

LABEL maintainer="Slow Ninja <info@slow.ninja>"

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Dev: webpack-dev-server with live reload. Bind-mount the repo at /app in compose.
FROM base AS dev

EXPOSE 8081

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# Prod: build static assets, serve via nginx.
FROM base AS builder

ARG STRUCTS_GUILD_API_URL=""
ENV STRUCTS_GUILD_API_URL=${STRUCTS_GUILD_API_URL}

RUN npm run build

FROM nginx:1.27-alpine AS prod

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
