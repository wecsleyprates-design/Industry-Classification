import { UUID } from "crypto";

import { WATCHLIST_ENTITY_TYPE } from "#lib/facts/kyb/types";
import type { IBusinessEntityAddressSource } from "#types/db";

/** Shape of Baselayer search object in API/webhook payloads (subset used for mapping). */
export type BaselayerSearchMappingInput = {
	business_name_match?: string | null;
	business_address_match?: string | null;
	business_officer_match?: string | null;
	tin_matched?: boolean | null;
	watchlist_hits?: Array<Record<string, unknown>>;
};

export function matchFieldToReviewStatus(
	v: string | null | undefined
): "success" | "failure" | "warning" {
	if (!v) return "warning";
	const u = v.toUpperCase();
	if (u === "EXACT") return "success";
	if (u === "SIMILAR") return "warning";
	return "failure";
}

export function buildBaselayerReviewTasks(
	businessEntityVerificationId: UUID,
	search: BaselayerSearchMappingInput
): Array<Record<string, unknown>> {
	const rows: Array<Record<string, unknown>> = [];
	rows.push({
		business_entity_verification_id: businessEntityVerificationId,
		category: "verification",
		key: "name",
		status: matchFieldToReviewStatus(search.business_name_match),
		message: search.business_name_match || "",
		label: "Business name match",
		sublabel: "",
		metadata: JSON.stringify({ signal: search.business_name_match })
	});
	rows.push({
		business_entity_verification_id: businessEntityVerificationId,
		category: "verification",
		key: "address_verification",
		status: matchFieldToReviewStatus(search.business_address_match),
		message: search.business_address_match || "",
		label: "Business address match",
		sublabel: "",
		metadata: JSON.stringify({ signal: search.business_address_match })
	});
	rows.push({
		business_entity_verification_id: businessEntityVerificationId,
		category: "verification",
		key: "person_verification",
		status: matchFieldToReviewStatus(search.business_officer_match),
		message: search.business_officer_match || "",
		label: "Officer match",
		sublabel: "",
		metadata: JSON.stringify({ signal: search.business_officer_match })
	});
	let tinStatus: "success" | "failure" | "warning" = "warning";
	if (search.tin_matched === true) tinStatus = "success";
	else if (search.tin_matched === false) tinStatus = "failure";
	rows.push({
		business_entity_verification_id: businessEntityVerificationId,
		category: "verification",
		key: "tin",
		status: tinStatus,
		message: search.tin_matched == null ? "TIN pending or unavailable" : String(search.tin_matched),
		label: "TIN match",
		sublabel: "",
		metadata: JSON.stringify({ tin_matched: search.tin_matched })
	});

	const hits = search.watchlist_hits || [];
	const watchlistMetadata = hits.map(h => ({
		code: h.code,
		name: h.name,
		count: h.count,
		details: h.details,
		entity_type: WATCHLIST_ENTITY_TYPE.BUSINESS
	}));
	const watchStatus: "success" | "failure" | "warning" =
		hits.some(h => Number(h.count) > 0) ? "failure" : "success";
	rows.push({
		business_entity_verification_id: businessEntityVerificationId,
		category: "verification",
		key: "watchlist",
		status: watchStatus,
		message: "Baselayer watchlist screening",
		label: "Watchlist",
		sublabel: "",
		metadata: JSON.stringify(watchlistMetadata)
	});

	return rows;
}

export function mapBaselayerAddresses(
	businessEntityVerificationId: UUID,
	biz: Record<string, unknown>
): Partial<IBusinessEntityAddressSource>[] {
	const list = (biz.addresses as Array<Record<string, unknown>>) || [];
	return list.map(a => {
		const street = (a.street as string) || "";
		const city = (a.city as string) || "";
		const state = (a.state as string) || "";
		const zip = (a.zip as string) || "";
		const country =
			typeof a.country === "string" && a.country.trim() !== "" ? a.country.trim() : "";
		const fullAddressParts = [street, city, state, zip];
		if (country) {
			fullAddressParts.push(country);
		}
		const full_address = fullAddressParts.filter(Boolean).join(", ");

		return {
			business_entity_verification_id: businessEntityVerificationId,
			external_id: a.id as UUID,
			full_address,
			address_line_1: street,
			address_line_2: undefined,
			city,
			state,
			postal_code: zip,
			lat: (a.latitude as number) ?? undefined,
			long: (a.longitude as number) ?? undefined,
			submitted: false,
			deliverable: Boolean(a.deliverable),
			cmra: Boolean(a.cmra),
			address_property_type: (a.delivery_type as string) || ""
		};
	});
}
