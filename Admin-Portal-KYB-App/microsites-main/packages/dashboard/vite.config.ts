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
				name: "dashboard_app",
				filename: "remoteEntry.js",
				exposes: {
					"./Home": "./src/page/Home/Home",
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
					"recharts",
					"react-is",
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
			dedupe: ["react", "react-dom"],
		},
		server: {
			port: parseInt((process.env as any).VITE_PORT) || 5176,
			host: "0.0.0.0", // allow external access to dev server(like access through mobile device)
			open: false, // open browser on start
			https, // enable https
			cors: {
				origin: "*",
				methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
				allowedHeaders: ["X-Requested-With", "content-type", "Authorization"],
			},
		},
	});

	return config;
};
