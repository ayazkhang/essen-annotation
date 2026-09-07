FROM node:22-bookworm-slim

WORKDIR /app/frontend

RUN corepack enable && corepack prepare yarn@1.22.22 --activate

COPY frontend/docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 5173

ENTRYPOINT ["/entrypoint.sh"]
CMD ["yarn", "dev", "--host", "0.0.0.0", "--port", "5173"]
