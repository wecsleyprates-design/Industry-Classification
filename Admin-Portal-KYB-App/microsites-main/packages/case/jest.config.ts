import { type Config } from "@jest/types";

const config: Config.InitialOptions = {
	verbose: true,
	testEnvironment: "jsdom",
	setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
	transform: {
		"^.+\\.tsx?$": [
			"ts-jest",
			{
				tsconfig: {
					jsx: "react-jsx",
				},
			},
		],
	},
	moduleNameMapper: {
		"@/(.*)": "<rootDir>/src/$1",
	},
	transformIgnorePatterns: ["node_modules/(?!(lucide-react|.*\\.mjs$))"],
};

export default config;
