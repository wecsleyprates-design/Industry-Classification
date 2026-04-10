import "@testing-library/jest-dom";

// Mock import.meta.env for Jest environment
Object.defineProperty(globalThis, "import", {
	value: {
		meta: {
			env: {
				VITE_API_ENDPOINT: "http://localhost:3001",
				// Add other env vars as needed
			},
		},
	},
});

// Mock origin for axios config
Object.defineProperty(globalThis, "origin", {
	value: "http://localhost:3000",
	writable: true,
});
