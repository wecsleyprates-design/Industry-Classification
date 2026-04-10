import React from "react";
import {
	CheckBadgeIcon,
	ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { capitalize } from "@/lib/helper";
import { type ApiResponse } from "@/types/api";
import { type FactsBusinessKybResponseType } from "@/types/integrations";

import { Badge, VerificationBadge } from "@/ui/badge";
import { Skeleton } from "@/ui/skeleton";

export const TinBadge: React.FC<{
	kybFactsData:
		| Pick<
				ApiResponse<FactsBusinessKybResponseType>["data"],
				"tin" | "tin_match" | "tin_match_boolean"
		  >
		| undefined;
	loading?: boolean;
}> = ({ kybFactsData, loading }) => {
	if (loading) return <Skeleton className="w-[85px] h-7 ml-auto" />;

	let IconComponent: typeof CheckBadgeIcon;
	let variant: "info" | "warning";
	let text: string;

	if (kybFactsData?.tin_match_boolean?.value) {
		IconComponent = CheckBadgeIcon;
		variant = "info";
		text = "Verified";
	} else {
		IconComponent = ExclamationTriangleIcon;
		variant = "warning";
		text =
			kybFactsData?.tin_match?.value?.status === "failure"
				? "Unverified"
				: (capitalize(kybFactsData?.tin_match?.value?.status) ??
					"Unverified");
	}

	return (
		<VerificationBadge variant={variant}>
			<IconComponent />
			{text}
		</VerificationBadge>
	);
};
