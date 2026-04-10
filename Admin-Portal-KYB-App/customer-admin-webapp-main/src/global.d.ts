/// <reference types="vite-plugin-pwa/client" />
declare global {
	interface Window {
		__federation_shared__?: any;
	}
}
