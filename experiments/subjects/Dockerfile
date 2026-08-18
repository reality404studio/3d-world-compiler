FROM node:22.18.0-bookworm-slim@sha256:752ea8a2f758c34002a0461bd9f1cee4f9a3c36d48494586f60ffce1fc708e0e

WORKDIR /subject-adapter
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY runner.mjs ./runner.mjs

USER 1000:1000
ENTRYPOINT ["node", "/subject-adapter/runner.mjs"]
