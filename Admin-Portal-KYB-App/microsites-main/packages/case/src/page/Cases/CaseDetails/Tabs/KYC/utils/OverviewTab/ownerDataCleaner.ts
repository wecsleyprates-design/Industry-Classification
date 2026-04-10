import { type FactsKycOwnerData } from "@/types/integrations";

/**
 * Utility functions for cleaning owner data before sending to the override API.
 * The backend has strict Zod schema requirements, so we need to ensure
 * all fields have the correct types.
 */

/**
 * Clean the title field to match the backend schema.
 * Backend expects: number | { id: number, title: string } | null
 * Frontend may have: string | number | { id: number, title: string } | null
 *
 * @param title - The title value from the owner data
 * @param originalTitle - The original title from the API (to preserve id when editing)
 * @param getTitleByName - Optional lookup function to convert title string to { id, title } object
 */
export function cleanTitleForOverride(
	title: FactsKycOwnerData["title"],
	originalTitle?: FactsKycOwnerData["title"],
	getTitleByName?: (
		name: string,
	) => { id: number; title: string } | undefined,
): number | { id: number; title: string } | null {
	if (title == null) {
		return null;
	}
	// If it's a number (ID), keep it as-is
	if (typeof title === "number") {
		return title;
	}
	// If it's an object with id and title, keep it
	if (typeof title === "object" && "id" in title && "title" in title) {
		return { id: Number(title.id), title: String(title.title) };
	}
	// If it's a plain string (title text from dropdown), look up the ID
	if (typeof title === "string") {
		// Try to look up the full title object by name
		if (getTitleByName) {
			const titleObj = getTitleByName(title);
			if (titleObj) {
				return { id: titleObj.id, title: titleObj.title };
			}
		}
		// Fallback: If original title was an object with an id, use that id with the new string
		if (
			originalTitle &&
			typeof originalTitle === "object" &&
			"id" in originalTitle
		) {
			return { id: Number(originalTitle.id), title };
		}
		// Backend doesn't accept plain strings without ID, so return null
		return null;
	}
	return null;
}

/**
 * Clean owner data to match the backend schema for the override API.
 * Ensures all fields have the correct types expected by the Zod schema.
 *
 * @param owner - The merged owner data (API data + pending edits)
 * @param originalOwner - The original owner from the API (to preserve title id)
 * @param getTitleByName - Optional lookup function to convert title string to { id, title }
 */
export function cleanOwnerForOverride(
	owner: FactsKycOwnerData,
	originalOwner?: FactsKycOwnerData,
	getTitleByName?: (
		name: string,
	) => { id: number; title: string } | undefined,
): FactsKycOwnerData {
	return {
		id: owner.id,
		first_name: owner.first_name ?? null,
		last_name: owner.last_name ?? null,
		date_of_birth: owner.date_of_birth ?? null,
		ssn: owner.ssn ?? null,
		email: owner.email ?? null,
		mobile: owner.mobile ?? null,
		title: cleanTitleForOverride(
			owner.title,
			originalOwner?.title,
			getTitleByName,
		),
		address_line_1: owner.address_line_1 ?? null,
		address_line_2: owner.address_line_2 ?? null,
		address_apartment: owner.address_apartment ?? null,
		address_city: owner.address_city ?? null,
		address_state: owner.address_state ?? null,
		address_postal_code: owner.address_postal_code ?? null,
		address_country: owner.address_country ?? null,
		ownership_percentage:
			typeof owner.ownership_percentage === "number"
				? owner.ownership_percentage
				: owner.ownership_percentage != null
					? Number(owner.ownership_percentage)
					: null,
		owner_type: owner.owner_type ?? null,
		created_at:
			typeof owner.created_at === "string"
				? owner.created_at
				: owner.created_at != null
					? String(owner.created_at)
					: null,
		updated_at:
			typeof owner.updated_at === "string"
				? owner.updated_at
				: owner.updated_at != null
					? String(owner.updated_at)
					: null,
	};
}
