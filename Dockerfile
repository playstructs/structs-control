# structs-control — single image; STRUCTS_CONTROL_MODE=dev|prod selects runtime.

FROM node:22-bookworm

LABEL maintainer="Slow Ninja <info@slow.ninja>"

RUN apt-get update && \
    apt-get install -y --no-install-recommends nginx && \
    rm -f /etc/nginx/sites-enabled/default && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG STRUCTS_GUILD_API_URL=""
ENV STRUCTS_GUILD_API_URL=${STRUCTS_GUILD_API_URL}

RUN npm run build

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/entrypoint.sh /usr/local/bin/structs-control-entrypoint
RUN chmod +x /usr/local/bin/structs-control-entrypoint

ENV STRUCTS_CONTROL_MODE=prod

EXPOSE 80 8081

ENTRYPOINT ["structs-control-entrypoint"]
