// Stub for the `server-only` import guard (used by lib/auth/session.ts etc.)
// under Vitest. The real package throws when `window` exists, which jsdom
// (this project's test environment) always provides — so the real package
// would fail every test that transitively imports a "server-only" module,
// not just ones that actually run in a browser. Aliased in vitest.config.ts.
export {};
