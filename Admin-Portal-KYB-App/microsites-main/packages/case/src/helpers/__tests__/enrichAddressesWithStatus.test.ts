import {
	enrichAddressesWithStatusFor360ReportParity,
	normalizeForAddressComparison,
} from "../enrichAddressesWithStatus";

// Mock the modules that depend on import.meta.env / Vite runtime
jest.mock("@/lib/utils", () => ({
	formatAddress: jest.fn((addr: unknown) =>
		typeof addr === "string" ? addr : "",
	),
}));

// ─── normalizeForAddressComparison ──────────────────────────────────

describe("normalizeForAddressComparison", () => {
	it("should treat 'Suite' and 'Unit' as equivalent", () => {
		const a = normalizeForAddressComparison(
			"171 E Liberty St, Suite 201, NT, M6K 3P6",
		);
		const b = normalizeForAddressComparison(
			"171 E Liberty St, Unit 201, NT, M6K 3P6",
		);
		expect(a).toBe(b);
	});

	it("should treat 'Ste' and 'Unit' as equivalent", () => {
		const a = normalizeForAddressComparison(
			"100 Main St, Ste 5, NY, 10001",
		);
		const b = normalizeForAddressComparison(
			"100 Main St, Unit 5, NY, 10001",
		);
		expect(a).toBe(b);
	});

	it("should treat 'Apt' and 'Unit' as equivalent", () => {
		const a = normalizeForAddressComparison(
			"200 Oak Ave, Apt 3B, CA, 90001",
		);
		const b = normalizeForAddressComparison(
			"200 Oak Ave, Unit 3B, CA, 90001",
		);
		expect(a).toBe(b);
	});

	it("should treat 'Apartment' and 'Unit' as equivalent", () => {
		const a = normalizeForAddressComparison(
			"200 Oak Ave, Apartment 3B, CA, 90001",
		);
		const b = normalizeForAddressComparison(
			"200 Oak Ave, Unit 3B, CA, 90001",
		);
		expect(a).toBe(b);
	});

	it("should treat 'Floor' and 'Fl' as equivalent", () => {
		const a = normalizeForAddressComparison(
			"500 Park Ave, Floor 10, NY, 10022",
		);
		const b = normalizeForAddressComparison(
			"500 Park Ave, Fl 10, NY, 10022",
		);
		expect(a).toBe(b);
	});

	it("should produce lowercase output", () => {
		const result = normalizeForAddressComparison(
			"171 E Liberty St, Suite 201, NT, M6K 3P6",
		);
		expect(result).toBe(result.toLowerCase());
	});

	it("should handle addresses without unit designators", () => {
		const a = normalizeForAddressComparison("171 E Liberty St, NT, M6K3E7");
		const b = normalizeForAddressComparison("171 E Liberty St, NT, M6K3E7");
		expect(a).toBe(b);
	});

	it("should handle addresses with country suffix consistently", () => {
		const a = normalizeForAddressComparison(
			"171 E Liberty St, Suite 201, NT, M6K 3P6, Canada",
		);
		const b = normalizeForAddressComparison(
			"171 E Liberty St, Unit 201, NT, M6K 3P6",
		);
		expect(a).toBe(b);
	});
});

// ─── enrichAddressesWithStatusFor360ReportParity ────────────────────

describe("enrichAddressesWithStatusFor360ReportParity", () => {
	const makeAddress = (address: string, isPrimary = false) => ({
		address,
		is_primary: isPrimary,
	});

	/** Helper to build a full AddressesValue mock with required fields */
	const makeVerification = (
		addresses: string[],
		status: "success" | "failure",
		baseAddresses?: string[],
	) => ({
		addresses,
		baseAddresses,
		status,
		label: "Address Verification",
		sublabel: "",
		message: "",
	});

	describe("registrationVerification", () => {
		it("should mark address as verified when it exactly matches a verification address", () => {
			const addresses = [
				makeAddress("171 E Liberty St, Unit 201, NT, M6K 3P6, Canada"),
			];
			const verification = makeVerification(
				["171 E Liberty St, Unit 201, NT, M6K 3P6"],
				"success",
			);

			const result = enrichAddressesWithStatusFor360ReportParity(
				addresses,
				[],
				verification,
				false,
			);

			expect(result[0].registrationVerification?.status).toBe("success");
		});

		it("should mark address as verified when Suite matches Unit in verification addresses", () => {
			const addresses = [
				makeAddress("171 E Liberty St, Suite 201, NT, M6K 3P6, Canada"),
			];
			const verification = makeVerification(
				["171 E Liberty St, Unit 201, NT, M6K 3P6"],
				"success",
			);

			const result = enrichAddressesWithStatusFor360ReportParity(
				addresses,
				[],
				verification,
				false,
			);

			expect(result[0].registrationVerification?.status).toBe("success");
		});

		it("should mark address as verified when Apt matches Unit in verification addresses", () => {
			const addresses = [
				makeAddress("171 E Liberty St, Apt 201, NT, M6K 3P6, Canada"),
			];
			const verification = makeVerification(
				["171 E Liberty St, Unit 201, NT, M6K 3P6"],
				"success",
			);

			const result = enrichAddressesWithStatusFor360ReportParity(
				addresses,
				[],
				verification,
				false,
			);

			expect(result[0].registrationVerification?.status).toBe("success");
		});

		it("should mark address as failure when no matching verification address exists", () => {
			const addresses = [makeAddress("999 Unrelated St, NY, 10001, US")];
			const verification = makeVerification(
				["171 E Liberty St, Unit 201, NT, M6K 3P6"],
				"success",
			);

			const result = enrichAddressesWithStatusFor360ReportParity(
				addresses,
				[],
				verification,
				false,
			);

			expect(result[0].registrationVerification?.status).toBe("failure");
		});

		it("should mark address as failure when verification status is not success", () => {
			const addresses = [
				makeAddress("171 E Liberty St, Unit 201, NT, M6K 3P6, Canada"),
			];
			const verification = makeVerification(
				["171 E Liberty St, Unit 201, NT, M6K 3P6"],
				"failure",
			);

			const result = enrichAddressesWithStatusFor360ReportParity(
				addresses,
				[],
				verification,
				false,
			);

			expect(result[0].registrationVerification?.status).toBe("failure");
		});

		it("should mark address as failure when verification is null", () => {
			const addresses = [
				makeAddress("171 E Liberty St, Unit 201, NT, M6K 3P6, Canada"),
			];

			const result = enrichAddressesWithStatusFor360ReportParity(
				addresses,
				[],
				null,
				false,
			);

			expect(result[0].registrationVerification?.status).toBe("failure");
		});

		it("should correctly handle mix of matching and non-matching addresses (Dream Payments scenario)", () => {
			const addresses = [
				makeAddress("171 E Liberty St, Suite 201, NT, M6K 3P6, Canada"),
				makeAddress("171 E Liberty St, NT, M6K3E7, Canada"),
				makeAddress("171 E Liberty St, Unit 201, NT, M6K 3P6, Canada"),
			];
			const verification = makeVerification(
				[
					"171 E Liberty St, NT, M6K3E7",
					"171 E Liberty St, Unit 201, NT, M6K 3P6",
				],
				"success",
			);

			const result = enrichAddressesWithStatusFor360ReportParity(
				addresses,
				[],
				verification,
				false,
			);

			// Suite 201 should now match Unit 201
			expect(result[0].registrationVerification?.status).toBe("success");
			// Exact match
			expect(result[1].registrationVerification?.status).toBe("success");
			// Exact match
			expect(result[2].registrationVerification?.status).toBe("success");
		});

		it("should mark address as verified via baseAddresses fallback when unit number is missing", () => {
			// Scenario: Google/SERP reports "171 E Liberty St, NT, M6K 3P6"
			// Trulioo verified "171 E Liberty St, Unit 201, NT, M6K3P6"
			// The backend provides baseAddresses with unit info stripped and
			// postal code normalized (no internal space).
			const addresses = [
				makeAddress("171 E Liberty St, NT, M6K 3P6, Canada"),
			];
			const verification = makeVerification(
				["171 E Liberty St, Unit 201, NT, M6K3P6"],
				"success",
				// Backend pre-computed: base address with unit stripped, postal code without space
				["171 e liberty st, nt, m6k3p6"],
			);

			const result = enrichAddressesWithStatusFor360ReportParity(
				addresses,
				[],
				verification,
				false,
			);

			expect(result[0].registrationVerification?.status).toBe("success");
		});

		it("should still mark as failure when baseAddresses do not match a different street", () => {
			const addresses = [makeAddress("999 Unrelated St, NY, 10001, US")];
			const verification = makeVerification(
				["171 E Liberty St, Unit 201, NT, M6K3P6"],
				"success",
				["171 e liberty st, nt, m6k3p6"],
			);

			const result = enrichAddressesWithStatusFor360ReportParity(
				addresses,
				[],
				verification,
				false,
			);

			expect(result[0].registrationVerification?.status).toBe("failure");
		});

		it("should work without baseAddresses (backward compat)", () => {
			const addresses = [
				makeAddress("171 E Liberty St, Unit 201, NT, M6K 3P6, Canada"),
			];
			// No baseAddresses provided (old backend response)
			const verification = makeVerification(
				["171 E Liberty St, Unit 201, NT, M6K 3P6"],
				"success",
			);

			const result = enrichAddressesWithStatusFor360ReportParity(
				addresses,
				[],
				verification,
				false,
			);

			expect(result[0].registrationVerification?.status).toBe("success");
		});
	});

	describe("googleProfileVerification", () => {
		it("should set googleProfileVerification to true for primary address when google profile matches", () => {
			const addresses = [
				makeAddress("171 E Liberty St, NT, M6K3E7", true),
			];
			const verification = makeVerification(
				["171 E Liberty St, NT, M6K3E7"],
				"success",
			);

			const result = enrichAddressesWithStatusFor360ReportParity(
				addresses,
				[],
				verification,
				true,
			);

			expect(result[0].googleProfileVerification).toBe(true);
		});

		it("should set googleProfileVerification to false for non-primary address even when google profile matches", () => {
			const addresses = [
				makeAddress("171 E Liberty St, NT, M6K3E7", false),
			];
			const verification = makeVerification(
				["171 E Liberty St, NT, M6K3E7"],
				"success",
			);

			const result = enrichAddressesWithStatusFor360ReportParity(
				addresses,
				[],
				verification,
				true,
			);

			expect(result[0].googleProfileVerification).toBe(false);
		});

		it("should set googleProfileVerification to false when google profile does not match", () => {
			const addresses = [
				makeAddress("171 E Liberty St, NT, M6K3E7", true),
			];

			const result = enrichAddressesWithStatusFor360ReportParity(
				addresses,
				[],
				null,
				false,
			);

			expect(result[0].googleProfileVerification).toBe(false);
		});
	});

	describe("deliverable", () => {
		it("should mark address as deliverable when normalized address is in deliverable list", () => {
			const addresses = [
				makeAddress("171 E Liberty St, NT, M6K3E7, Canada"),
			];
			const deliverable = ["171 E Liberty St, NT, M6K3E7"];

			const result = enrichAddressesWithStatusFor360ReportParity(
				addresses,
				deliverable,
				null,
				false,
			);

			expect(result[0].deliverable).toBe(true);
		});

		it("should mark address as not deliverable when not in deliverable list", () => {
			const addresses = [
				makeAddress("171 E Liberty St, NT, M6K3E7, Canada"),
			];

			const result = enrichAddressesWithStatusFor360ReportParity(
				addresses,
				[],
				null,
				false,
			);

			expect(result[0].deliverable).toBe(false);
		});
	});

	describe("edge cases", () => {
		it("should return empty array for null addresses", () => {
			const result = enrichAddressesWithStatusFor360ReportParity(
				null,
				[],
				null,
				false,
			);
			expect(result).toEqual([]);
		});

		it("should skip null entries in addresses array", () => {
			const addresses = [
				null,
				makeAddress("171 E Liberty St, NT, M6K3E7, Canada"),
			];

			const result = enrichAddressesWithStatusFor360ReportParity(
				addresses,
				[],
				null,
				false,
			);

			expect(result).toHaveLength(1);
		});
	});
});
