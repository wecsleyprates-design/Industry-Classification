/**
 * GIACT API Constants
 * Shared constants for GIACT API endpoints and configuration
 */

export const GIACT_API_PATHS = {
	/**
	 * GIACT API endpoint for verification services
	 * Used by both production and sandbox strategies
	 */
	VERIFICATION_SERVICES: "/verificationservices/web_api/inquiries_v5_9"
} as const;

export const GIACT_SERVICE_FLAGS = {
	VERIFY: "verify",
	AUTHENTICATE: "authenticate"
} as const;

// Golden EIN stored on business/case; This along with a SANDBOX customer type indicates remap for a successful GIACT verification.
export const GOLDEN_TIN_GIACT_REMAP_FROM = "990747539";

// This is the TIN we want to remap to in order to get a valid verification responses from GIACT
export const GOLDEN_TIN_GIACT_REMAP_TO = "123456543";

// This is the business information we want to remap to in order to get a valid verification responses from GIACT
export const GOLDEN_TIN_GIACT_SANDBOX_BUSINESS_OUTBOUND = {
	BusinessName: "Smith & Associates Consulting",
	PhoneNumber: "2145551212",
	AddressEntity: {
		AddressLine1: "1113 Shade Tree Ln",
		City: "Allen",
		State: "TX",
		ZipCode: "75013",
		Country: "US"
	}
} as const;

// This is the business bank information we want to remap to in order to get a valid verification responses from GIACT
export const GOLDEN_TIN_GIACT_SANDBOX_BANK_OUTBOUND = {
	RoutingNumber: "122105278",
	CheckingAccountNumber: "0000000025",
	SavingsAccountNumber: "0000000019"
} as const;
