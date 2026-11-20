# Financial frontend

One repository containing both existing React applications:

- `apps/user`: public financial terminal (source `23b88f2`).
- `apps/admin`: administration dashboard (source `6fe4b24`).

Application source code, API clients, tests and dependency lockfiles are preserved unchanged. Each app remains an independent Vite build, with its own configuration and dependency installation. This is a repository consolidation; both apps can be deployed independently.

## Setup

Use Node 24, npm and pnpm 11.25.0.

```sh
cd apps/admin
npm ci
cd ../user
pnpm install --frozen-lockfile
cd ../..
```

Copy each app's `.env.example` to its own `.env.local` and configure the existing backend origin. Local private configuration was preserved during migration; it is never committed.

## Run

From the repository root:

```sh
pnpm dev:user   # http://127.0.0.1:5173
pnpm dev:admin  # http://127.0.0.1:5174 (second terminal)
pnpm test
pnpm typecheck
pnpm build
```

Use separate origins for the two applications. The backend CORS allowlist must include the origins actually used. Admin credentials remain managed by the existing admin UI; do not place private secrets in Vite variables.

Production outputs are `apps/user/dist` and `apps/admin/dist`. Set the hosting root to the appropriate app folder; hosting previously configured at the repository root must be updated. This migration does not deploy either application.

## Verification and history

The original admin history is retained. User import records the source commit using Git subtree metadata. CI runs each app's own tests and builds. Browser tests use intercepted fixture responses and do not certify production backend data. See each app's README and docs for its existing features and limitations.

Migration checks on 2026-11-20: both production builds passed, admin unit tests 11/11 and user unit tests 10/10 passed, and all three admin browser fixture suites passed from their new directories. No application source logic was changed. User browser tests against a real Java backend were not rerun as part of this repository migration. Existing local Git branches were backed up in ignored `.local-backup/*.bundle` files before removing the old folders.
