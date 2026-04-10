import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import prettier from 'eslint-config-prettier';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default tseslint.config(
	{
		ignores: [
			'node_modules/**',
			'dist/**',
			'build/**',
			'dev-dist/**',
			'tailwind.config.js',
			'postcss.config.js',
			'jest.config.ts',
			'jest.setup.ts',
			'vite.config.ts',
			'.eslintrc.js',
		],
	},
	js.configs.recommended,
	...tseslint.configs.recommended,
	{
		files: ['**/*.{ts,tsx,js,jsx}'],
		languageOptions: {
			ecmaVersion: 'latest',
			sourceType: 'module',
			parserOptions: {
				project: './tsconfig.eslint.json',
				tsconfigRootDir: __dirname,
			},
			globals: {
				window: 'readonly',
				document: 'readonly',
				React: 'readonly',
			},
		},
		plugins: {
			react,
			'react-hooks': reactHooks,
			'simple-import-sort': simpleImportSort,
		},
		settings: {
			react: {
				version: 'detect',
			},
		},
		rules: {
			...react.configs.recommended.rules,
			'react/react-in-jsx-scope': 'off',
			'react/prop-types': 'off',
			'react/no-unescaped-entities': 'off',
			'no-console': ['error', { allow: ['warn', 'error'] }],
			'@typescript-eslint/strict-boolean-expressions': 'off',
			'@typescript-eslint/explicit-function-return-type': 'off',
			'@typescript-eslint/triple-slash-reference': 'off',
			'@typescript-eslint/restrict-template-expressions': 'off',
			'@typescript-eslint/consistent-type-assertions': 'off',
			
			'@typescript-eslint/no-misused-promises': [
				'error',
				{
					checksVoidReturn: {
						attributes: false,
					},
				},
			],
			'simple-import-sort/imports': [
				'error',
				{
					groups: [
						[
							'^react',
							'^@?\\w',
							'^@/(components|enums|hooks|layouts|lib|models|pages|routes|services|store|types|assets)(/.*|$)',
							'^\\u0000',
							'^\\.\\.(?!/?$)',
							'^\\.\\./?$',
							'^\\./(?=.*/)(?!/?$)',
							'^\\.(?!/?$)',
							'^\\./?$',
							'^.+\\.s?css$',
						],
					],
				},
			],
			'@typescript-eslint/consistent-type-definitions': 'off',
			'@typescript-eslint/consistent-type-imports': [
				'error',
				{
					prefer: 'type-imports',
					fixStyle: 'inline-type-imports',
				},
			],
			'react-hooks/rules-of-hooks': 'error',
			'react-hooks/exhaustive-deps': 'off',
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-unused-vars':'off'
		},
	},
	prettier
);
