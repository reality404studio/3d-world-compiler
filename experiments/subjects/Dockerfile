FROM node:22.18.0-bookworm-slim

WORKDIR /subject-adapter
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY runner.mjs ./runner.mjs

USER 1000:1000
ENTRYPOINT ["node", "/subject-adapter/runner.mjs"]
