FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 PAYMENT_MODE=demo
COPY package.json package-lock.json ./
RUN --mount=type=secret,id=build_ca \
    if [ -f /run/secrets/build_ca ]; then \
      NODE_EXTRA_CA_CERTS=/run/secrets/build_ca npm ci --no-audit --no-fund; \
    else npm ci --no-audit --no-fund; fi
COPY app ./app
COPY components ./components
COPY lib ./lib
COPY scripts ./scripts
COPY data ./data
COPY public ./public
COPY catalog/images ./catalog/images
COPY next.config.ts tsconfig.json next-env.d.ts proxy.ts ./
RUN node scripts/prepare-demo.mjs && npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PAYMENT_MODE=demo PORT=10000
COPY --from=build /app /app
RUN chmod -R a+rX /app && mkdir -p /app/.next/cache \
    && chown -R node:node /app/.local /app/.next/cache \
    && chmod 700 /app/.local && chmod 600 /app/.local/*.sqlite
USER node
EXPOSE 10000
CMD ["node", "scripts/start-store.mjs"]
