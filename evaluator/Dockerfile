FROM node:22.18.0-bookworm-slim

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
WORKDIR /evaluator

COPY package.json package-lock.json ./
RUN npm ci
RUN npx playwright install --with-deps chromium

COPY . .

ARG EXPECTED_MANIFEST_SHA256
RUN test -n "$EXPECTED_MANIFEST_SHA256"
RUN node --import tsx scripts/verify-freeze.ts --expect "$EXPECTED_MANIFEST_SHA256"
RUN npm run typecheck

ENV EXPECTED_MANIFEST_SHA256=$EXPECTED_MANIFEST_SHA256

RUN mkdir -p /input /output
RUN chmod -R a-w /evaluator /ms-playwright

USER node
ENTRYPOINT ["node", "--import", "tsx", "scripts/evaluate-renderable.ts"]
