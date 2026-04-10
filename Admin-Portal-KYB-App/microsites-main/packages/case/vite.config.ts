import federation from "@originjs/vite-plugin-federation";
import react from "@vitejs/plugin-react-swc";
import fs from "fs";
import path from "path";
import { defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import tsconfigPaths from "vite-tsconfig-paths";
import { PWAConfig } from "./src/lib/config";
import tailwindcss from "@tailwindcss/vite";

const keyPath = path.resolve(__dirname, "./ssl/localhost.key");
const certPath = path.resolve(__dirname, "./ssl/localhost.cert");

let https: undefined | { key: string; cert: string };
if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
	https = {
		key: fs.readFileSync(keyPath, "utf8"),
		cert: fs.readFileSync(certPath, "utf8"),
	};
}

// https://vitejs.dev/config/
export default async ({ mode }) => {
	process.env = { ...process.env, ...loadEnv(mode, process.cwd()) };

	// import.meta.env.VITE_NAME available here with: process.env.VITE_NAME
	// import.meta.env.VITE_PORT available here with: process.env.VITE_PORT

	// eslint-disable-next-line @typescript-eslint/await-thenable
	const config = await defineConfig({
		plugins: [
			react(),
			tsconfigPaths(),
			VitePWA(PWAConfig),
			tailwindcss(),
			federation({
				name: "case_app",
				filename: "remoteEntry.js",
				exposes: {
					"./CaseTable": "./src/page/Cases/CaseTable",
					"./CustomerCaseTable":
						"./src/page/Cases/CaseTable/CustomerCaseTable",
					"./StandaloneCaseTable":
						"./src/page/Cases/CaseTable/StandaloneCaseTable",
					"./CustomerDetailsCaseTable":
						"./src/page/Cases/CaseTable/CustomerDetailsCaseTable",
					"./CaseDetails": "./src/page/Cases/CaseDetails",
					"./StandaloneCaseDetails":
						"./src/page/Cases/CaseDetails/StandaloneCaseDetails",
					"./CustomerCaseDetails":
						"./src/page/Cases/CaseDetails/CustomerCaseDetails",
					"./CustomerDetailsCaseDetails":
						"./src/page/Cases/CaseDetails/CustomerDetailsCaseDetails",
					"./BusinessCaseTable":
						"./src/page/Cases/CaseTable/BusinessCaseTable",
					"./BusinessCaseDetails":
						"./src/page/Cases/CaseDetails/BusinessCaseDetails",
					"./CustomerBusinessTable":
						"./src/page/Cases/BusinessTable/CustomerBusinessTable",
					"./MerchantProfilesTable":
						"./src/page/Cases/BusinessTable/MerchantProfilesTable",
				},
				shared: [
					"react",
					"react-dom",
					"@tanstack/react-query",
					"react-router-dom",
					"react-router",
					"tailwindcss",
					"react-multi-date-picker",
					"launchdarkly-react-client-sdk",
					"zustand",
				],
			}),
		],
		build: {
			modulePreload: false,
			target: "esnext",
			minify: false,
			cssCodeSplit: false,
			manifest: true,
		},
		resolve: {
			alias: {
				"@": path.resolve(__dirname, "./src"),
			},
			dedupe: ["react", "react-dom"],
		},
		server: {
			port: parseInt((process.env as any).VITE_PORT) || 5177,
			host: "0.0.0.0", // allow external access to dev server(like access through mobile device)
			open: false, // open browser on start
			https, // enable https
			cors: {
				origin: "*",
				methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
				allowedHeaders: [
					"X-Requested-With",
					"content-type",
					"Authorization",
				],
			},
		},
	});

	return config;
};
