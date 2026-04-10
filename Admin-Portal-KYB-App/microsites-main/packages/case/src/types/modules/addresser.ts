/**
 * Q: Why is this here?
 * A: The `IParsedAddress` interface is erroneously missing the `formattedAddress` property.
 *    This file serves to extend the `IParsedAddress` interface with the `formattedAddress` property.
 */

declare module "addresser" {
	export function parseAddress(addressString: string): ParsedAddress;

	export interface ParsedAddress {
		// e.g. "328 S Orange Ave"
		addressLine1?: string;
		// e.g. "Unit 100"
		addressLine2?: string;
		// e.g. "Orlando"
		placeName?: string;
		// e.g. "Florida"
		stateName?: string;
		// e.g. "328 S Orange Ave, Unit 100, Orlando, FL 32801, USA"
		formattedAddress?: string;
		// e.g. "32801"
		zipCode?: `${number}` | `${number}-${number}`;
		// e.g. "FL"
		stateAbbreviation?: string;
		// e.g. "328"
		streetNumber?: string;
		// e.g. "S Orange"
		streetName?: string;
		// e.g. "Ave"
		streetSuffix?: string;
		// e.g. '328-S-Orange-Ave,-Unit-100,-Orlando,-FL-32801'
		id: string;
	}
}
