import { useMemo } from "react";
import { formatDate } from "@/lib/helper";
import { formatAddress, formatPhoneNumber } from "@/lib/utils";
import { useGetFactsKyc } from "@/services/queries/integration.query";
import { type Owner } from "@/types/case";
import { type FactsKycOwnerData } from "@/types/integrations";
import type { FieldOverridesMap } from "../../../../components/fieldSource.types";
import {
	extractFieldOverrides,
	extractOverride,
	type FieldOverrideInfo,
} from "../../../../components/fieldSource.utils";

import { VALUE_NOT_AVAILABLE } from "@/constants";
import { formatSSN } from "@/helpers/case";

interface UseOverviewTabDataParams {
	/** Owner data from case details (fallback) */
	owner: Owner | null;
	/** Business ID for fetching from KYC facts API */
	businessId: string;
	/** Owner ID to filter from the facts response */
	ownerId: string;
	isLoading?: boolean;
}

/**
 * Helper to format address from KYC facts owner data
 */
function formatFactsOwnerAddress(owner: FactsKycOwnerData | null): string {
	if (!owner) return "";
	const parts = [
		owner.address_line_1,
		owner.address_apartment,
		owner.address_city,
		owner.address_state,
		owner.address_postal_code,
	].filter(Boolean);
	return parts.join(", ");
}

/**
 * Hook that handles data extraction for OverviewTab.
 * Fetches data from the KYC facts API and falls back to owner prop.
 * Returns original values, loading states, and derived data.
 */
export function useOverviewTabData({
	owner,
	businessId,
	ownerId,
	isLoading = false,
}: UseOverviewTabDataParams) {
	// Fetch KYC facts from the new API
	const { data: kycFactsResponse, isLoading: isLoadingKycFacts } =
		useGetFactsKyc(businessId);

	// Extract the specific owner from KYC facts response
	const kycOwner = useMemo(() => {
		const owners = kycFactsResponse?.data?.owners_submitted?.value;
		if (!owners || !ownerId) return null;
		return owners.find((o) => o.id === ownerId) ?? null;
	}, [kycFactsResponse, ownerId]);

	// Guest owner edits from KYC facts API (or fallback to owner prop)
	const guestOwnerEdits = useMemo(
		() =>
			kycFactsResponse?.data?.guest_owner_edits ??
			owner?.guest_owner_edits ??
			[],
		[kycFactsResponse?.data?.guest_owner_edits, owner?.guest_owner_edits],
	);

	// Get the override data if it exists
	// The override value is an array of owners, so find the specific owner by ID
	const overrideData = useMemo(() => {
		const override = kycFactsResponse?.data?.owners_submitted?.override;
		if (!override?.value || !ownerId) return null;
		// Override value is an array of FactsKycOwnerData
		const overrideOwners = override.value;
		return overrideOwners.find((o) => o.id === ownerId) ?? null;
	}, [kycFactsResponse, ownerId]);

	// Extract original values - prefer KYC facts API data, fall back to owner prop
	const originalValues = useMemo(() => {
		// Use KYC facts data if available
		const sourceOwner = kycOwner;

		if (!sourceOwner && !owner) {
			return {
				firstName: "",
				lastName: "",
				dateOfBirth: "",
				ssn: "",
				homeAddress: "",
				mobile: "",
				email: "",
				title: "",
				ownershipPercentage: "",
			};
		}

		// If we have KYC facts data, use it
		if (sourceOwner) {
			const firstName = sourceOwner.first_name ?? "";
			const lastName = sourceOwner.last_name ?? "";
			const dateOfBirth = sourceOwner.date_of_birth ?? "";
			const ssn = sourceOwner.ssn ? formatSSN(sourceOwner.ssn) : "";
			const homeAddress = formatFactsOwnerAddress(sourceOwner);
			const mobile = formatPhoneNumber(sourceOwner.mobile) ?? "";
			const email = sourceOwner.email ?? "";
			// Title from facts can be number, { id, title } object, or null
			// Extract the title string from the object if available
			const titleFromFacts = sourceOwner.title;
			const title =
				typeof titleFromFacts === "object" &&
				titleFromFacts !== null &&
				"title" in titleFromFacts
					? titleFromFacts.title
					: (owner?.title?.title ?? "");
			const ownershipPercentage = sourceOwner.ownership_percentage
				? String(sourceOwner.ownership_percentage)
				: "";

			return {
				firstName,
				lastName,
				dateOfBirth,
				ssn,
				homeAddress,
				mobile,
				email,
				title,
				ownershipPercentage,
			};
		}

		// Fall back to owner prop
		const firstName = owner?.first_name ?? "";
		const lastName = owner?.last_name ?? "";
		const dateOfBirth = owner?.date_of_birth ?? "";
		const ssn = owner?.ssn ? formatSSN(owner.ssn) : "";
		const homeAddress = formatAddress(owner) ?? "";
		const mobile = formatPhoneNumber(owner?.mobile) ?? "";
		const email = owner?.email ?? "";
		const title = owner?.title?.title ?? "";
		const ownershipPercentage = owner?.ownership_percentage
			? String(owner.ownership_percentage)
			: "";

		return {
			firstName,
			lastName,
			dateOfBirth,
			ssn,
			homeAddress,
			mobile,
			email,
			title,
			ownershipPercentage,
		};
	}, [kycOwner, owner]);

	// Format display values for non-editable display
	const displayValues = useMemo(() => {
		return {
			firstName: originalValues.firstName || VALUE_NOT_AVAILABLE,
			lastName: originalValues.lastName || VALUE_NOT_AVAILABLE,
			dateOfBirth: originalValues.dateOfBirth
				? formatDate(originalValues.dateOfBirth, "MM/DD/YYYY", {
						local: false,
					})
				: VALUE_NOT_AVAILABLE,
			ssn: originalValues.ssn || VALUE_NOT_AVAILABLE,
			homeAddress: originalValues.homeAddress || VALUE_NOT_AVAILABLE,
			mobile: originalValues.mobile || VALUE_NOT_AVAILABLE,
			email: originalValues.email || VALUE_NOT_AVAILABLE,
			title: originalValues.title || VALUE_NOT_AVAILABLE,
			ownershipPercentage: originalValues.ownershipPercentage
				? `${originalValues.ownershipPercentage}%`
				: VALUE_NOT_AVAILABLE,
		};
	}, [originalValues]);

	// Get the full owners array for use with override API
	const allOwners = useMemo(() => {
		return kycFactsResponse?.data?.owners_submitted?.value ?? [];
	}, [kycFactsResponse]);

	const ownersSubmittedOverrideInfo = useMemo<FieldOverrideInfo | null>(
		() => extractOverride(kycFactsResponse?.data?.owners_submitted),
		[kycFactsResponse],
	);

	const fieldOverridesMap = useMemo<FieldOverridesMap | null>(
		() => extractFieldOverrides(kycFactsResponse?.data?.owners_submitted),
		[kycFactsResponse],
	);

	return {
		originalValues,
		displayValues,
		loadingStates: {
			owner: isLoading || isLoadingKycFacts,
			verification: isLoading,
		},
		guestOwnerEdits,
		owner: kycOwner ? { ...owner, ...kycOwner } : owner,
		overrideData,
		ownersSubmittedOverrideInfo,
		fieldOverridesMap,
		factsDataSources: [kycFactsResponse?.data] as Array<
			Record<string, any> | undefined
		>,
		isUsingFactsApi: !!kycOwner,
		allOwners,
	};
}
