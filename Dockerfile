# syntax=docker/dockerfile:1.12

ARG NODE_IMAGE=node:24.19.0-bookworm-slim@sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df
ARG RUNTIME_IMAGE=gcr.io/distroless/nodejs24-debian13:nonroot@sha256:774b7d020b24214835769e24c3544835526cd0288f0b094eae48e8b2c2429a79

FROM ${NODE_IMAGE} AS dependencies
ENV PNPM_HOME=/pnpm
ENV PATH=/pnpm:$PATH
RUN corepack enable && corepack prepare pnpm@11.21.0 --activate
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/nalanda-cross-platform/package.json apps/nalanda-cross-platform/package.json
COPY apps/portable-migrator/package.json apps/portable-migrator/package.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile

FROM dependencies AS builder
ARG SOURCE_COMMIT=unknown
ARG SOURCE_DATE_EPOCH=0
ENV DATABASE_PROVIDER=postgresql
ENV DATABASE_URL=postgresql://build.invalid/nalanda_build
ENV DIRECT_URL=postgresql://build.invalid/nalanda_build
ENV NALANDA_STANDALONE_BUILD=true
ENV NEXT_TELEMETRY_DISABLED=1
ENV SOURCE_DATE_EPOCH=${SOURCE_DATE_EPOCH}
COPY . .
RUN pnpm db:generate:postgres
RUN pnpm portable:bundle
RUN pnpm build

FROM dependencies AS migration-dependencies
RUN pnpm --filter @nalanda/portable-runtime-dependencies deploy --prod /migration

FROM builder AS runtime-files
COPY --from=migration-dependencies /migration/node_modules /migration-node_modules
RUN mkdir -p /runtime/node_modules \
    && cp -a /migration-node_modules/. /runtime/node_modules/ \
    && cp -a /app/.next/standalone/. /runtime/

FROM ${RUNTIME_IMAGE} AS runtime
ARG SOURCE_COMMIT=unknown
ARG SOURCE_URL=https://github.com/vsairohith67/nalanda-school-erp
ARG IMAGE_VERSION=portable-staging-foundation-1a
LABEL org.opencontainers.image.title="Nalanda School ERP portable runtime" \
      org.opencontainers.image.description="Provider-neutral private synthetic staging runtime" \
      org.opencontainers.image.source="${SOURCE_URL}" \
      org.opencontainers.image.revision="${SOURCE_COMMIT}" \
      org.opencontainers.image.version="${IMAGE_VERSION}" \
      org.opencontainers.image.licenses="UNLICENSED"
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV NALANDA_IMAGE_COMMAND=web
COPY --from=runtime-files --chown=65532:65532 /runtime ./
COPY --from=builder --chown=65532:65532 /app/.next/static ./.next/static
COPY --from=builder --chown=65532:65532 /app/public ./public
COPY --from=builder --chown=65532:65532 /app/dist/portable ./dist/portable
COPY --from=builder --chown=65532:65532 /app/prisma/postgresql ./prisma/postgresql
COPY --from=builder --chown=65532:65532 /app/package.json ./package.json
USER 65532:65532
EXPOSE 3000
ENTRYPOINT ["/nodejs/bin/node"]
CMD ["dist/portable/runtime-command.mjs", "web"]
