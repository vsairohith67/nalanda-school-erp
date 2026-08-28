# OCI image build and runtime

Build with `docker build --pull=false --build-arg SOURCE_COMMIT=<sha> --build-arg SOURCE_DATE_EPOCH=<epoch> -t nalanda-portable-staging:<tag> .`. The Dockerfile pins Node and distroless images by digest, installs with the frozen pnpm lock, generates the PostgreSQL Prisma client, creates the Next standalone output, prunes development dependencies, and copies only runtime files.

The final image runs as UID/GID 65532, has no shell or package manager, and receives a read-only root filesystem plus a bounded `noexec,nosuid,nodev` temporary mount. The default command is `web`; migration and seed are separate one-shot commands. Never mount `DIRECT_URL` into web replicas. Never run `seed-synthetic` without both the synthetic environment and explicit opt-in.

The build context excludes Git data, databases and sidecars, storage, backups, generated secrets, local TLS, models, signing material, QA output, and native build artifacts.
