FROM node:22.23.4-bookworm-slim@sha256:de170b39439eb0e5a3444ad7d60b015614a381e10fecae2e30ec9e735122f38d

WORKDIR /subject-adapter
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY runner.mjs ./runner.mjs

USER 1000:1000
ENTRYPOINT ["node", "/subject-adapter/runner.mjs"]
