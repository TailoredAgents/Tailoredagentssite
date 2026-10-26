FROM mcr.microsoft.com/playwright:v1.64.1-noble
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev
COPY --chown=pwuser:pwuser lib ./lib
COPY --chown=pwuser:pwuser scripts ./scripts
COPY --chown=pwuser:pwuser tsconfig.json ./
USER pwuser
CMD ["node", "--conditions=react-server", "--import", "tsx", "scripts/run-factory-build-worker.ts", "--drain"]
