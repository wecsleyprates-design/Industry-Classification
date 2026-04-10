import * as fs from "fs";

interface PackageJson {
	name: string;
	version: string;
	description: string;
}

const cwd = process.cwd();
const packageJsonPath = `${cwd}/package.json`;

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8")) as PackageJson;

export const pkgConfig = {
	APP_NAME: packageJson.name,
	APP_VERSION: packageJson.version,
	APP_DESCRIPTION: packageJson.description
};
