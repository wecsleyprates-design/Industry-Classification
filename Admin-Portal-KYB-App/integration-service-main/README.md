# Setting up server

```bash
# Run all required dependencies: postgres
make up

# Setup env
cp .env.example .env.local
cp .env.example .env
- Set right values environment values in both files. As a practice, we use .env.local for local environment and .env for production environment.

# Keys
Add necessary keys under keys directory

# Create database schema using migrations
npm run migrate:up

# Start dev server
npm run dev
```

## Docker commands

```bash
# Kill all containers
make down
# Reset all docker data and start afresh
make reset
```

Refer `Makefile` for other commands.

## Making commits

We leverage [commitzen](https://www.npmjs.com/package/git-cz) to make clean and meaningful commits.

To make a commit once changes are done:

```bash
# Stage all your changes
git add .

#run commit with commitzen
npm run commit
```

## Create or run SQL migration scripts

```bash

# Add your database configuration to the .env file. The migration commands will not retrieve database configuration settings from other environment files.

# Create mirgration script
npm run migrate:create <migration-name>

# Spin up all sql migrations: migrate up
npm run migrate:up

# NOTE: migrate-up might not work if you have a dirty database, to reset it, run:
npm run migrate:reset
```

Refer `package.json` for more npm scripts

## Unit Testing

We use [Jest](https://jestjs.io/docs/getting-started) for testing the code.

Refer the link for more comprehensive details.

**Note**: Installing Jest globally is an anti-pattern, along with most global package installs. NPM automatically looks in the local `node_modules/.bin` directory for executables like Jest. Using the local version means that decisions made about what version of Jest is required for _this_ repo are honored. Any version-specific behavior, or related tooling could be broken with a global install of the wrong version, so that should be avoided. `package.json` scripts can use commands like `jest` directly, as if installed globally. NPM will resolve the locally installed version for you automatically. `npx` can be used to run the local install of `jest` for one-off runs of test files.

```bash
# Run all tests with the repo-local Jest version
npm run test

# Run all tests with coverage
npm run test:coverage

# Run a specific test file with the repo-local Jest version
npx jest -- <name-of-file>

# Pull LaunchDarkly feature flags to local feature_flags.json file
# Whenever you want to test feature flags on local you can make tweaks in local feature_flags.json and test your file
make feature-flags LD_SDK_KEY=LaunchDarkly-SDK-Key-here
```

## Local Performance Baseline

Use `docs/performance/search-business-details-local-baseline.md` for the local `search-business-details` baseline workflow, including the stubbed Serp path and the `autocannon` load helper.

`CONFIG_SERPAPI_BASE_URL` defaults to `https://serpapi.com`. For the local stub workflow, point it at `http://127.0.0.1:18765` in `.env.local` or your shell environment.

Migration note: replace `SERP_API_LOCAL_ORIGIN=http://127.0.0.1:18765` with `CONFIG_SERPAPI_BASE_URL=http://127.0.0.1:18765`.

`CONFIG_SERPAPI_BASE_URL` is part of the committed env config surface and is intentionally optional in `compare-configs` during rollout, so deployed configs do not need an immediate update.

## Ephemeral Worker Job System

The integration service includes a job management system to launch ephemeral jobs for running background tasks.

### When to Use

Use the job system for:

- **CPU/memory intensive tasks** that need isolation
- **Long-running processes** that shouldn't block the main application process
- **Tasks that need to run in ephemeral environments**

### Adding a New Job

1. **Create a job handler** in the appropriate module:

   ```typescript
   // lib/yourModule/jobHandler.ts
   export async function handleYourJob(job: JobTask): Promise<void> {
   	// Your business logic here
   }
   ```

2. **Register the handler** in `src/jobs/handlers/index.ts`:

   ```typescript
   export { handleYourJob } from "#lib/yourModule/jobHandler";
   export const jobHandlers = {
   	YOUR_JOB: "handleYourJob"
   };
   ```

3. **Start the job** from your business logic:

   ```typescript
   import { jobManager } from "#jobs/jobManager";

   const job = await jobManager.runJob({
   	jobType: "YOUR_JOB",
   	payload: {
   		/* your data */
   	},
   	businessId: "business-id"
   });
   ```

### Local vs Kubernetes

- **Local Development**: Jobs run in the same process (automatic when `NODE_ENV=development`)
- **Production**: Jobs run as Kubernetes Jobs with full isolation and resource management

### Monitoring

- **Redis Status Tracking**: Jobs update their status in Redis (`job-{job-id}`)
- **Datadog Integration**: Jobs are tagged with `job-id` and `job-type` for filtering and service `integration-service-jobs`
- **Job Monitoring**: Use `jobManager.monitorJob(jobId)` to track completion in-code

## ESM Package Compatibility Pattern

When integrating pure ESM packages (like @kubernetes/client-node v1.x) into our
CommonJS codebase, use a wrapper pattern:

1. Create a `.js` wrapper file (not `.ts`)
2. Use dynamic import() to load the ESM module
3. Cache the loaded module
4. Export via module.exports

See: src/jobs/providers/kubernetesClientWrapper.js
