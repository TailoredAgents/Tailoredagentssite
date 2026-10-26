FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends gosu ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY apps/factory-preview/worker.mjs ./apps/factory-preview/worker.mjs
COPY apps/factory-render/service.mjs apps/factory-render/entrypoint.sh ./apps/factory-render/
RUN chmod 755 /app/apps/factory-render/entrypoint.sh && mkdir -p /var/data/factory && chown node:node /var/data/factory
ENV NODE_ENV=production PORT=10000 FACTORY_STORAGE_DIRECTORY=/var/data/factory
EXPOSE 10000
ENTRYPOINT ["/app/apps/factory-render/entrypoint.sh"]
