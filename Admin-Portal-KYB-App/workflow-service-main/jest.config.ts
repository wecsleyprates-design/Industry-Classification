import type { Config } from "jest";

const config: Config = {
	preset: "ts-jest",
	testEnvironment: "node",
	roots: ["<rootDir>/src", "<rootDir>/lib"],
	testMatch: ["**/__tests__/**/*.ts", "**/?(*.)+(spec|test).ts"],
	testPathIgnorePatterns: ["<rootDir>/src/__tests__/setup/", "<rootDir>/src/__tests__/helpers/"],
	transform: {
		"^.+\\.ts$": "ts-jest"
	},
	collectCoverageFrom: ["src/**/*.ts", "!src/**/*.d.ts", "!src/**/__tests__/**", "!src/**/index.ts"],
	coverageDirectory: "coverage",
	coverageReporters: ["text", "lcov", "html"],
	setupFilesAfterEnv: [
		"<rootDir>/src/__tests__/setup/jest.setup.ts",
		"<rootDir>/src/__tests__/setup/kafka-mocks.ts",
		"<rootDir>/src/__tests__/setup/bull-mocks.ts",
		"<rootDir>/src/__tests__/setup/uuid-mocks.ts",
		"<rootDir>/src/__tests__/setup/redis-mocks.ts"
	],
	testTimeout: 10000,
	moduleNameMapper: {
		"^uuid$": "<rootDir>/node_modules/uuid/dist/index.js",
		"^#api$": "<rootDir>/src/api/index.ts",
		"^#api/(.*)$": "<rootDir>/src/api/$1",
		"^#configs$": "<rootDir>/src/configs/index.ts",
		"^#configs/(.*)$": "<rootDir>/src/configs/$1",
		"^#constants$": "<rootDir>/src/constants/index.ts",
		"^#constants/(.*)$": "<rootDir>/src/constants/$1",
		"^#core$": "<rootDir>/src/core/index.ts",
		"^#core/(.*)$": "<rootDir>/src/core/$1",
		"^#database$": "<rootDir>/src/database/index.ts",
		"^#database/(.*)$": "<rootDir>/src/database/$1",
		"^#helpers$": "<rootDir>/src/helpers/index.ts",
		"^#helpers/(.*)$": "<rootDir>/src/helpers/$1",
		"^#middlewares$": "<rootDir>/src/middlewares/index.ts",
		"^#middlewares/(.*)$": "<rootDir>/src/middlewares/$1",
		"^#services$": "<rootDir>/src/services/index.ts",
		"^#services/(.*)$": "<rootDir>/src/services/$1",
		"^#types$": "<rootDir>/src/types/index.ts",
		"^#types/(.*)$": "<rootDir>/src/types/$1",
		"^#utils$": "<rootDir>/src/utils/index.ts",
		"^#utils/(.*)$": "<rootDir>/src/utils/$1",
		"^#workers$": "<rootDir>/src/workers/index.ts",
		"^#workers/(.*)$": "<rootDir>/src/workers/$1",
		"^#workflows$": "<rootDir>/src/api/v1/modules/workflows/index.ts",
		"^#workflows/(.*)$": "<rootDir>/src/api/v1/modules/workflows/$1",
		"^#triggers$": "<rootDir>/src/api/v1/modules/triggers/index.ts",
		"^#triggers/(.*)$": "<rootDir>/src/api/v1/modules/triggers/$1",
		"^#lib$": "<rootDir>/lib/index.ts",
		"^#lib/(.*)$": "<rootDir>/lib/$1",
		"^#messaging$": "<rootDir>/src/messaging/index.ts",
		"^#messaging/(.*)$": "<rootDir>/src/messaging/$1"
	},
	modulePathIgnorePatterns: ["<rootDir>/dist/"],
	transformIgnorePatterns: ["node_modules/(?!(uuid)/)"],
	clearMocks: true,
	restoreMocks: true,
	silent: true,
	verbose: false
};

export default config;
