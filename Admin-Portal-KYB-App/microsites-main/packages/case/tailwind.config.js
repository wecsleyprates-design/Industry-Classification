import tailwindcssAnimate from "tailwindcss-animate";

/** @type {import('tailwindcss').Config} */
export default {
	// In v4, most configuration is done in CSS via @theme
	// This file is kept for compatibility and plugin support
	// The tailwindcss-animate plugin may still need this config
	content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
	important: ".case", // used to isolate styles between remote app (this app) and host app.
	plugins: [tailwindcssAnimate],
};
