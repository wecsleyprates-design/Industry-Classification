# Microsites

A Mono repo created for managing multiple microsites built with  React js.

Confluence document link: [Microsites documentation](https://worth-ai.atlassian.net/wiki/spaces/joinworth/pages/220102658/DOS-277+Microsites+Setup)

## Local Development

In order to use Doppler to manage environment variables, you must first do the following via terminal:

1. Ensure you are authenticated with Doppler using `doppler login`
2. `cd` into each package folder and run `doppler setup`
3. Each package should have a doppler.yaml to pull Doppler config from so you can just use those settings
4. Run doppler commands ie. `npm run start:doppler`

[Doppler documentation](https://docs.doppler.com/docs/vitejs-and-sveltejs)

If you prefer to use a local .env file, you can just run the normal script command `npm run start`.
