import "@testing-library/jest-dom/vitest";

// Placeholder env so modules that import the validated `lib/env` / `lib/env.server`
// load in the test runner. Real values never touch unit tests.
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.NEXT_PUBLIC_APP_URL ??= "http://localhost:3000";
process.env.NEXT_PUBLIC_ENV ??= "development";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
