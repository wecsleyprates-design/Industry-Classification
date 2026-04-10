import * as addressUtil from "@/lib/address";
import { formatAddress } from "@/lib/utils";
import { type AddressesValue } from "@/types/integrations";

export interface EnrichedAddress {
	address: string;
	deliverable: boolean;
	registrationVerification: Pick<AddressesValue, "status"> | null;
	googleProfileVerification?: boolean;
	isPrimary?: boolean;
}

type MaybeEmpty<T> = T | null | undefined;

/**
 * Regex to match common secondary unit designators (case-insensitive).
 * These terms are semantically equivalent for address comparison purposes:
 * Suite, Ste, Unit, Apt, Apartment, #, No, Num, Fl, Floor, Rm, Room
 *
 * Different data sources (e.g. Trulioo vs Google) may report the same
 * physical address using different designators (e.g. "Suite 201" vs "Unit 201").
 * Normalizing them to a common form ("Unit") allows correct matching.
 */
const UNIT_DESIGNATOR_REGEX =
	/\b(suite|ste|unit|apt|apartment|no|num|number|fl|floor|rm|room|dept|department|bldg|building)\b\.?\s*/gi;

/**
 * Normalizes an address string for comparison by:
 * 1. Applying the standard address normalization (parses and re-formats)
 * 2. Replacing all secondary unit designators with a common token ("Unit ")
 * 3. Lowercasing for case-insensitive comparison
 *
 * This ensures addresses like "171 E Liberty St, Suite 201, NT, M6K 3P6"
 * and "171 E Liberty St, Unit 201, NT, M6K 3P6" are treated as equivalent.
 */
export const normalizeForAddressComparison = (address: string): string =>
	addressUtil
		.normalizeString(address)
		.replace(UNIT_DESIGNATOR_REGEX, "Unit ")
		.replace(/\s+/g, " ")
		.trim()
		.toLowerCase();

const hasVerificationStatus = (
	targetAddress: string,
	addressVerification: MaybeEmpty<AddressesValue>,
): addressVerification is AddressesValue =>
	!!addressVerification?.addresses?.some(
		(a) => formatAddress(a) === targetAddress,
	);

export const enrichAddressesWithStatus = (
	addresses: MaybeEmpty<Array<MaybeEmpty<string>>>,
	deliverableAddresses: MaybeEmpty<Array<MaybeEmpty<string>>>,
	addressVerification: MaybeEmpty<AddressesValue>,
): EnrichedAddress[] => {
	const fa = new Set(addresses?.map(formatAddress) ?? []);
	const fda = deliverableAddresses?.map(formatAddress) ?? [];
	const enrichedAddresses: EnrichedAddress[] = [];

	for (const address of fa) {
		if (!address) continue; // Skip empty addresses

		const enriched: EnrichedAddress = {
			address,
			deliverable: fda.some((addr) => addr === address),
			// We should only include the verification status if it exists for this specific address
			registrationVerification: hasVerificationStatus(
				address,
				addressVerification,
			)
				? addressVerification
				: null,
		};

		enrichedAddresses.push(enriched);
	}

	// Sort the result by `.address` (alphabetically)
	return enrichedAddresses.sort((a, b) => {
		return a.address.localeCompare(b.address);
	});
};

/**
 * Temporary function to ensure parity with 360 report.
 * @see https://worth-ai.atlassian.net/browse/PAT-749
 */
export const enrichAddressesWithStatusFor360ReportParity = (
	addresses: MaybeEmpty<
		Array<MaybeEmpty<{ address: string; is_primary: boolean }>>
	>,
	deliverableAddresses: MaybeEmpty<Array<MaybeEmpty<string>>>,
	addressVerification: MaybeEmpty<AddressesValue>,
	googleProfileMatch: boolean,
): EnrichedAddress[] => {
	const enrichedAddresses: EnrichedAddress[] = [];

	// Pre-compute normalized verification addresses for comparison.
	// This uses a deeper normalization that equates secondary unit designators
	// (Suite, Unit, Apt, etc.) so that addresses from different data sources
	// (e.g. Trulioo "Unit 201" vs Google "Suite 201") are correctly matched.
	const normalizedVerificationAddresses =
		addressVerification?.addresses?.map(normalizeForAddressComparison) ??
		[];

	// Base verification addresses come pre-computed from the backend (unit info
	// already stripped). This handles the case where one data source reports a
	// building address without a unit number while the verified address includes one.
	const baseVerificationAddresses = addressVerification?.baseAddresses ?? [];

	for (const address of addresses ?? []) {
		if (!address) continue; // Skip empty addresses

		const normalizedAddress = addressUtil.normalizeString(address.address);
		const normalizedForComparison = normalizeForAddressComparison(
			address.address,
		);

		// Match strategy:
		// 1. Primary: exact match after unit designator normalization (Suite=Unit=Apt)
		// 2. Fallback: match against backend-computed base addresses (unit stripped)
		//    to handle cases where one source omits the unit number entirely
		const isRegistrationVerified =
			(normalizedVerificationAddresses.includes(
				normalizedForComparison,
			) ||
				baseVerificationAddresses.includes(
					normalizedAddress.toLowerCase(),
				)) &&
			addressVerification?.status === "success";

		enrichedAddresses.push({
			address: address.address,
			deliverable:
				deliverableAddresses?.includes(normalizedAddress) ?? false,
			registrationVerification: {
				status: isRegistrationVerified ? "success" : "failure",
			},
			// The google profile business_match status is calculated using the primary submitted address
			// if the business_match is "Match Found", we assume the primary submitted address is verified
			googleProfileVerification: googleProfileMatch && address.is_primary,
			isPrimary: address.is_primary,
		});
	}

	return enrichedAddresses;
};
