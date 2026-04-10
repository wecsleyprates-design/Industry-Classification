import { useMemo } from "react";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import { formatSourceDate } from "@/lib/utils";

import { VALUE_NOT_AVAILABLE } from "@/constants";
import type { BadgeProps } from "@/ui/badge";

interface WebsiteData {
	domain?: {
		creation_date?: string;
		expiration_date?: string;
	};
	parked?: boolean;
	status?: string;
}

interface NonEditableField {
	label: string;
	value: string;
	badge?: {
		text: string;
		variant: BadgeProps["variant"];
		icon?: React.ForwardRefExoticComponent<any> | null;
	};
}

/**
 * Hook that generates non-editable fields for WebsiteTab.
 * Returns N/A for all fields when website field is dirty (has been edited).
 */
export function useWebsiteNonEditableFields(
	websiteData: WebsiteData | null | undefined,
	isWebsiteDirty: boolean,
): NonEditableField[] {
	return useMemo(() => {
		// If website field has been edited, show N/A for all dependent fields
		if (isWebsiteDirty) {
			return [
				{
					label: "Creation Date",
					value: VALUE_NOT_AVAILABLE,
				},
				{
					label: "Expiration Date",
					value: VALUE_NOT_AVAILABLE,
				},
				{
					label: "Parked Domain",
					value: VALUE_NOT_AVAILABLE,
				},
				{
					label: "Status",
					value: VALUE_NOT_AVAILABLE,
					badge: {
						text: "Unknown",
						variant: "secondary",
						icon: null,
					},
				},
			];
		}

		if (!websiteData) {
			return [];
		}

		const badgeText = getStatusBadgeText(websiteData.status);
		const badgeVariant = getStatusBadgeVariant(websiteData.status);
		const badgeIcon =
			websiteData.status === "online" ? CheckCircleIcon : null;

		return [
			{
				label: "Creation Date",
				value: websiteData.domain?.creation_date
					? formatSourceDate(websiteData.domain.creation_date)
					: VALUE_NOT_AVAILABLE,
			},
			{
				label: "Expiration Date",
				value: websiteData.domain?.expiration_date
					? formatSourceDate(websiteData.domain.expiration_date)
					: VALUE_NOT_AVAILABLE,
			},
			{
				label: "Parked Domain",
				value: websiteData.parked ? "Yes" : "No",
			},
			{
				label: "Status",
				value: websiteData.status ?? VALUE_NOT_AVAILABLE,
				badge: {
					text: badgeText,
					variant: badgeVariant,
					icon: badgeIcon,
				},
			},
		];
	}, [websiteData, isWebsiteDirty]);
}

/**
 * Get status badge text from status value
 */
function getStatusBadgeText(status?: string): string {
	if (!status || typeof status !== "string") {
		return "Unknown";
	}

	const normalizedStatus = status.toLowerCase();
	if (normalizedStatus === "online") return "Online";
	if (normalizedStatus === "offline") return "Offline";
	return "Unknown";
}

/**
 * Get status badge variant from status value
 */
function getStatusBadgeVariant(status?: string): BadgeProps["variant"] {
	if (!status || typeof status !== "string") {
		return "secondary";
	}

	const normalizedStatus = status.toLowerCase();
	if (normalizedStatus === "online") return "success";
	if (normalizedStatus === "offline") return "error";
	return "secondary";
}
