FROM node:22-bookworm-slim

WORKDIR /app/backend

RUN corepack enable && corepack prepare yarn@1.22.22 --activate \
  && apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY backend/docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3001

ENTRYPOINT ["/entrypoint.sh"]
CMD ["yarn", "dev"]
