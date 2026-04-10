import { IntegrationSettingsSchema } from "../validation";

// Mock the envConfig module to bypass import.meta.env
jest.mock("@/config/envConfig", () => ({
	envConfig: {
		APP_ENV: "test",
	},
}));

const mockFile = {
	type: "application/x-pkcs12",
	lastModified: 0,
	name: "",
	webkitRelativePath: "",
	size: 0,
	arrayBuffer: async function (): Promise<ArrayBuffer> {
		throw new Error("Function not implemented.");
	},
	bytes: async function (): Promise<Uint8Array<ArrayBuffer>> {
		throw new Error("Function not implemented.");
	},
	slice: function (start?: number, end?: number, contentType?: string): Blob {
		throw new Error("Function not implemented.");
	},
	stream: function (): ReadableStream<Uint8Array<ArrayBuffer>> {
		throw new Error("Function not implemented.");
	},
	text: async function (): Promise<string> {
		throw new Error("Function not implemented.");
	},
} satisfies File;

describe("ICA Validation Coverage", () => {
	const validateIcas = async (icas: string | undefined): Promise<boolean> => {
		// Parse the comma-separated string into IcaItem[] array
		const icasArray = icas
			? icas
					.split(",")
					.map((ica) => ica.trim())
					.filter((ica) => ica.length > 0)
					.map((ica, index) => ({
						ica,
						isDefault: index === 0,
					}))
			: [];

		// Create a complete object to validate against the schema
		const formData = {
			isActive: true, // Required for validation to run
			consumerKey: "valid-key",
			keyPassword: "valid-password",
			keyFile: mockFile,
			icas: icasArray,
		};

		try {
			await IntegrationSettingsSchema.validate(formData);
			return true;
		} catch (error) {
			return false;
		}
	};

	it("should validate valid single ICA", async () => {
		expect(await validateIcas("ICA001")).toBe(true);
	});

	it("should validate valid multiple ICAs", async () => {
		expect(await validateIcas("ICA001, ICA002")).toBe(true);
	});

	it("should trim whitespace and validate", async () => {
		expect(await validateIcas(" ICA001 , ICA002 ")).toBe(true);
	});

	it("should fail validation for empty input", async () => {
		expect(await validateIcas("")).toBe(false);
	});

	it("should fail validation for whitespace-only input", async () => {
		expect(await validateIcas("   ")).toBe(false);
	});

	it("should fail validation for only commas", async () => {
		expect(await validateIcas(",,")).toBe(false);
	});

	it("should fail validation for invalid characters (special chars)", async () => {
		expect(await validateIcas("ICA-001")).toBe(false);
		expect(await validateIcas("ICA$")).toBe(false);
	});

	it("should fail validation for duplicate ICAs (exact match)", async () => {
		expect(await validateIcas("ICA001, ICA001")).toBe(false);
	});

	it("should fail validation for duplicate ICAs (case-insensitive)", async () => {
		expect(await validateIcas("ICA001, ica001")).toBe(false);
	});

	it("should handle mixed case valid ICAs", async () => {
		expect(await validateIcas("ICA001, ica002")).toBe(true);
	});

	it("should fail if no valid ICAs remain after filtering", async () => {
		expect(await validateIcas(" , ")).toBe(false);
	});

	it("should fail for more than 4 ICAs", async () => {
		expect(await validateIcas("ICA001, ICA002, ICA003, ICA004, ICA005")).toBe(
			false,
		);
	});
});

describe("ICA Validation - Inactive path", () => {
	it("should pass validation when isActive is false with blank ICA rows", async () => {
		const formData = {
			isActive: false,
			consumerKey: "",
			keyPassword: undefined,
			keyFile: null,
			icas: [{ ica: "", isDefault: true }],
		};

		await expect(
			IntegrationSettingsSchema.validate(formData),
		).resolves.toBeDefined();
	});

	it("should pass validation when isActive is false with no ICAs", async () => {
		const formData = {
			isActive: false,
			consumerKey: "",
			keyPassword: undefined,
			keyFile: null,
			icas: [],
		};

		await expect(
			IntegrationSettingsSchema.validate(formData),
		).resolves.toBeDefined();
	});

	it("should pass validation when isActive is false with partially filled ICAs", async () => {
		const formData = {
			isActive: false,
			consumerKey: "some-key",
			keyPassword: undefined,
			keyFile: null,
			icas: [
				{ ica: "ICA001", isDefault: true },
				{ ica: "", isDefault: false },
			],
		};

		await expect(
			IntegrationSettingsSchema.validate(formData),
		).resolves.toBeDefined();
	});
});

describe("ICA Validation - Single default rule", () => {
	it("should fail when no ICA is marked as default", async () => {
		const formData = {
			isActive: true,
			consumerKey: "valid-key",
			keyPassword: "valid-password",
			keyFile: mockFile,
			icas: [
				{ ica: "ICA001", isDefault: false },
				{ ica: "ICA002", isDefault: false },
			],
		};

		await expect(IntegrationSettingsSchema.validate(formData)).rejects.toThrow(
			"Exactly one ICA must be marked as default",
		);
	});

	it("should fail when multiple ICAs are marked as default", async () => {
		const formData = {
			isActive: true,
			consumerKey: "valid-key",
			keyPassword: "valid-password",
			keyFile: mockFile,
			icas: [
				{ ica: "ICA001", isDefault: true },
				{ ica: "ICA002", isDefault: true },
			],
		};

		await expect(IntegrationSettingsSchema.validate(formData)).rejects.toThrow(
			"Exactly one ICA must be marked as default",
		);
	});

	it("should pass when exactly one ICA is marked as default", async () => {
		const formData = {
			isActive: true,
			consumerKey: "valid-key",
			keyPassword: "valid-password",
			keyFile: mockFile,
			icas: [
				{ ica: "ICA001", isDefault: true },
				{ ica: "ICA002", isDefault: false },
			],
		};

		await expect(
			IntegrationSettingsSchema.validate(formData),
		).resolves.toBeDefined();
	});
});
