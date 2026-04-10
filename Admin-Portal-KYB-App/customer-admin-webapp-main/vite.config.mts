import federation from "@originjs/vite-plugin-federation";
import react from "@vitejs/plugin-react-swc";
import fs from "fs";
import path from "path";
import { defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from '@tailwindcss/vite'
import { PWAConfig } from "./src/lib/config";

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
export default defineConfig(({ mode }) => {
	process.env = { ...process.env, ...loadEnv(mode, process.cwd()) };

	return {
		optimizeDeps: {
			include: ["react", "react-dom"],
		},
		plugins: [
			react(),
			tsconfigPaths(),
			VitePWA(PWAConfig),
			tailwindcss(),
			federation({
				name: "app",
				filename: "hostEntry.js",
				remotes: {},
				// Explicitly expose the Login component for resolving dependencies issues. not consumed anywhere in remote apps
				exposes: {
					"./Login": "./src/pages/Auth/Login.tsx",
				},
				shared: [
					"react",
					"react-dom",
					"react-is",
					"@tanstack/react-query",
					"react-router-dom",
					"react-router",
					"tailwindcss",
					"react-multi-date-picker",
					"launchdarkly-react-client-sdk",
					"zustand",
					"react-select",
					"recharts",
				],
			}),
		],

		build: {
			modulePreload: false,
			target: "esnext",
			minify: false,
			cssCodeSplit: false,
		},
		server: {
			port: parseInt((process.env as Record<string, string>).VITE_PORT || "5174"),
			host: "0.0.0.0", // allow external access to dev server(like access through mobile device)
			open: false, // open browser on start
			https, // enable https
			watch: {
				usePolling: true, // Required for Docker on Mac/Windows
				interval: 100,
			},
		},
	};
});
