/**
 * Runs before any test file (via setupFiles).
 * @joinworth/worth-core-service loads dd-trace when NODE_ENV is not "development"
 * and requires DD_SERVICE and DD_ENV.
 */
process.env.DD_SERVICE = process.env.DD_SERVICE || "integration-service-test";
process.env.DD_ENV = process.env.DD_ENV || "test";
