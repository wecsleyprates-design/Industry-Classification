import { getItem } from "@/lib/localStorage";
import {
	formatSsnKycDisplay,
	getSubroleCodeForSsnKycDisplay,
	READ_SSN_CASE_PERMISSION,
	shouldAllowSsnLastFourAndRevealInCase,
	shouldShowSsnRevealEye,
} from "../ssnKycDisplay";

jest.mock("@/lib/localStorage", () => ({
	getItem: jest.fn(),
}));

const mockGetItem = getItem as jest.MockedFunction<typeof getItem>;

describe("ssnKycDisplay", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockGetItem.mockReturnValue(null);
	});

	describe("READ_SSN_CASE_PERMISSION", () => {
		it("matches backend READ_SSN_DATA code", () => {
			expect(READ_SSN_CASE_PERMISSION).toBe(
				"case:read:ssn_and_equivalents",
			);
		});
	});

	describe("getSubroleCodeForSsnKycDisplay", () => {
		it("returns empty string when subrole is missing", () => {
			mockGetItem.mockReturnValue(null);
			expect(getSubroleCodeForSsnKycDisplay()).toBe("");
		});

		it("returns trimmed code", () => {
			mockGetItem.mockReturnValue({
				id: "1",
				code: " owner ",
				label: "Owner",
			});
			expect(getSubroleCodeForSsnKycDisplay()).toBe("owner");
		});
	});

	describe("shouldAllowSsnLastFourAndRevealInCase", () => {
		const base = {
			ssnEncryptionEnabled: false,
			isPlatformAdmin: false,
			hasReadSsnPermission: false,
		};

		it("allows Worth platform admin regardless of FF and subrole", () => {
			expect(
				shouldAllowSsnLastFourAndRevealInCase({
					...base,
					isPlatformAdmin: true,
					ssnEncryptionEnabled: false,
					subroleCode: "anything",
				}),
			).toBe(true);
		});

		it("allows customer subrole admin regardless of FF", () => {
			expect(
				shouldAllowSsnLastFourAndRevealInCase({
					...base,
					subroleCode: "admin",
					ssnEncryptionEnabled: false,
				}),
			).toBe(true);
		});

		it("allows ADMIN code case-insensitively", () => {
			expect(
				shouldAllowSsnLastFourAndRevealInCase({
					...base,
					subroleCode: "Admin",
					ssnEncryptionEnabled: false,
				}),
			).toBe(true);
		});

		it("denies non-admin when FF off", () => {
			expect(
				shouldAllowSsnLastFourAndRevealInCase({
					...base,
					subroleCode: "owner",
					ssnEncryptionEnabled: false,
				}),
			).toBe(false);
		});

		it.each(["owner", "cro", "risk_analyst"] as const)(
			"allows %s when FF on",
			(code) => {
				expect(
					shouldAllowSsnLastFourAndRevealInCase({
						...base,
						subroleCode: code,
						ssnEncryptionEnabled: true,
					}),
				).toBe(true);
			},
		);

		it("denies other subrole when FF on without READ_SSN", () => {
			expect(
				shouldAllowSsnLastFourAndRevealInCase({
					...base,
					subroleCode: "custom_role",
					ssnEncryptionEnabled: true,
					hasReadSsnPermission: false,
				}),
			).toBe(false);
		});

		it("allows other subrole when FF on with READ_SSN", () => {
			expect(
				shouldAllowSsnLastFourAndRevealInCase({
					...base,
					subroleCode: "custom_role",
					ssnEncryptionEnabled: true,
					hasReadSsnPermission: true,
				}),
			).toBe(true);
		});

		it("denies empty subrole when FF off", () => {
			expect(
				shouldAllowSsnLastFourAndRevealInCase({
					...base,
					subroleCode: "",
					ssnEncryptionEnabled: false,
				}),
			).toBe(false);
		});

		it("allows empty subrole when FF on and READ_SSN", () => {
			expect(
				shouldAllowSsnLastFourAndRevealInCase({
					...base,
					subroleCode: "",
					ssnEncryptionEnabled: true,
					hasReadSsnPermission: true,
				}),
			).toBe(true);
		});
	});

	describe("formatSsnKycDisplay", () => {
		const na = "N/A";

		it("returns N/A when empty", () => {
			expect(
				formatSsnKycDisplay("", {
					ssnEncryptionEnabled: true,
					isPlatformAdmin: false,
					hasReadSsnPermission: false,
					valueNotAvailable: na,
					subroleCode: "owner",
				}),
			).toBe(na);
		});

		it("shows last 4 for admin subrole when FF off", () => {
			expect(
				formatSsnKycDisplay("123-45-6789", {
					ssnEncryptionEnabled: false,
					isPlatformAdmin: false,
					hasReadSsnPermission: false,
					valueNotAvailable: na,
					subroleCode: "admin",
				}),
			).toBe("XXX-XX-6789");
		});

		it("shows last 4 for platform admin when FF off", () => {
			expect(
				formatSsnKycDisplay("123-45-6789", {
					ssnEncryptionEnabled: false,
					isPlatformAdmin: true,
					hasReadSsnPermission: false,
					valueNotAvailable: na,
					subroleCode: "",
				}),
			).toBe("XXX-XX-6789");
		});

		it("masks owner when FF off", () => {
			expect(
				formatSsnKycDisplay("123-45-6789", {
					ssnEncryptionEnabled: false,
					isPlatformAdmin: false,
					hasReadSsnPermission: false,
					valueNotAvailable: na,
					subroleCode: "owner",
				}),
			).toBe("XXX-XX-XXXX");
		});

		it("shows last 4 for owner when FF on", () => {
			expect(
				formatSsnKycDisplay("123-45-6789", {
					ssnEncryptionEnabled: true,
					isPlatformAdmin: false,
					hasReadSsnPermission: false,
					valueNotAvailable: na,
					subroleCode: "owner",
				}),
			).toBe("XXX-XX-6789");
		});

		it("masks custom role when FF on without READ_SSN", () => {
			expect(
				formatSsnKycDisplay("123-45-6789", {
					ssnEncryptionEnabled: true,
					isPlatformAdmin: false,
					hasReadSsnPermission: false,
					valueNotAvailable: na,
					subroleCode: "analyst_custom",
				}),
			).toBe("XXX-XX-XXXX");
		});

		it("shows last 4 for custom role when FF on with READ_SSN", () => {
			expect(
				formatSsnKycDisplay("123-45-6789", {
					ssnEncryptionEnabled: true,
					isPlatformAdmin: false,
					hasReadSsnPermission: true,
					valueNotAvailable: na,
					subroleCode: "analyst_custom",
				}),
			).toBe("XXX-XX-6789");
		});

		it("uses subroleCode override without reading localStorage", () => {
			expect(
				formatSsnKycDisplay("123-45-6789", {
					ssnEncryptionEnabled: true,
					isPlatformAdmin: false,
					hasReadSsnPermission: true,
					valueNotAvailable: na,
					subroleCode: "x",
				}),
			).toBe("XXX-XX-6789");
			expect(mockGetItem).not.toHaveBeenCalled();
		});
	});

	describe("shouldShowSsnRevealEye", () => {
		const base = {
			ssnEncryptionEnabled: false,
			isPlatformAdmin: false,
			hasReadSsnPermission: false,
			subroleCode: "admin" as string,
		};

		it("is true for admin subrole when FF off", () => {
			expect(
				shouldShowSsnRevealEye({
					...base,
					subroleCode: "admin",
					ssnEncryptionEnabled: false,
				}),
			).toBe(true);
		});

		it("is false for owner when FF off", () => {
			expect(
				shouldShowSsnRevealEye({
					...base,
					subroleCode: "owner",
					ssnEncryptionEnabled: false,
				}),
			).toBe(false);
		});

		it("is true for owner when FF on", () => {
			expect(
				shouldShowSsnRevealEye({
					...base,
					subroleCode: "owner",
					ssnEncryptionEnabled: true,
				}),
			).toBe(true);
		});
	});
});
