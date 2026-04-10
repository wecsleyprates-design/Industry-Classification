import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import prettierPlugin from "eslint-plugin-prettier";
import prettierConfig from "eslint-config-prettier";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default [
	// Global ignores - these files/directories will be completely ignored
	{
		ignores: [
			"**/node_modules/**",
			"**/dist/**",
			"**/coverage/**",
			"**/logs/**",
			"**/*.d.ts",
			"db/migrations/migrate/*.js",
			"db/migrations/seed/*.js",
			"package.json",
			"bin/**",
			"plopfile.ts",
			"jest.config.ts",
			"tsconfig*.json",
			"db/dbmrc.ts",
			"scripts/**",
			"eslint.config.ts",
			"commitlint.config.ts",
			"subdomain.ts",
			"**/*.yml",
			"**/*.yaml",
			"Dockerfile",
			"Dockerfile.*",
			"docker-compose*.yml",
			"docker-compose*.yaml"
		]
	},
	// Configuration for JavaScript files
	{
		files: ["**/*.js"],
		languageOptions: {
			ecmaVersion: "latest",
			sourceType: "module",
			globals: {
				console: "readonly",
				process: "readonly",
				Buffer: "readonly",
				__dirname: "readonly",
				__filename: "readonly",
				module: "readonly",
				require: "readonly",
				exports: "readonly"
			}
		},
		rules: {
			"no-console": "warn",
			"no-debugger": "error",
			"no-tabs": "off",
			"no-unused-vars": [
				"error",
				{
					argsIgnorePattern: "^_",
					varsIgnorePattern: "^_",
					caughtErrorsIgnorePattern: "^_"
				}
			],
			"prefer-const": "error",
			"no-var": "error"
		}
	},
	// Configuration for TypeScript files
	{
		files: ["**/*.ts"],
		languageOptions: {
			parser: tsParser,
			ecmaVersion: "latest",
			sourceType: "module",
			parserOptions: {
				project: "./tsconfig.json",
				tsconfigRootDir: __dirname
			}
		},
		plugins: {
			"@typescript-eslint": tsPlugin,
			prettier: prettierPlugin
		},
		rules: {
			// Prettier integration
			"prettier/prettier": "error",

			// TypeScript recommended rules
			...tsPlugin.configs.recommended.rules,

			// Custom rules
			"@typescript-eslint/no-unused-vars": [
				"error",
				{
					argsIgnorePattern: "^_",
					varsIgnorePattern: "^_",
					caughtErrorsIgnorePattern: "^_"
				}
			],
			"@typescript-eslint/explicit-function-return-type": "off",
			"@typescript-eslint/explicit-module-boundary-types": "off",
			"@typescript-eslint/no-explicit-any": "warn",
			"@typescript-eslint/no-non-null-assertion": "warn",
			"@typescript-eslint/prefer-nullish-coalescing": "warn",
			"@typescript-eslint/prefer-optional-chain": "warn",
			"@typescript-eslint/no-unnecessary-type-assertion": "warn",
			"@typescript-eslint/no-floating-promises": "warn",
			"@typescript-eslint/await-thenable": "warn",
			"@typescript-eslint/no-misused-promises": "warn",
			"@typescript-eslint/no-unsafe-assignment": "warn",
			"@typescript-eslint/no-unsafe-call": "warn",
			"@typescript-eslint/no-unsafe-member-access": "warn",
			"@typescript-eslint/no-unsafe-argument": "warn",
			"@typescript-eslint/no-unsafe-return": "warn",
			"@typescript-eslint/restrict-template-expressions": "warn",
			"@typescript-eslint/no-namespace": "warn",

			// Naming conventions
			"@typescript-eslint/naming-convention": [
				"error",
				{
					selector: "variable",
					format: ["camelCase", "UPPER_CASE"],
					leadingUnderscore: "allow"
				},
				{
					selector: "variable",
					modifiers: ["destructured"],
					format: null
				},
				{
					selector: "function",
					format: ["camelCase"]
				},
				{
					selector: "typeLike",
					format: ["PascalCase"]
				},
				{
					selector: "enum",
					format: ["PascalCase", "UPPER_CASE"]
				}
			],

			// General rules
			"no-console": "warn",
			"no-debugger": "error",
			"no-tabs": "off",
			"prefer-const": "error",
			"no-var": "error"
		}
	},
	// Prettier config (must be last to override other formatting rules)
	prettierConfig
];
