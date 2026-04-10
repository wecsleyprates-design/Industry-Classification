import React from "react";
import {
	CheckCircleIcon,
	ExclamationCircleIcon,
} from "@heroicons/react/24/outline";

import { type BadgeProps, VerificationBadge } from "@/ui/badge";

export const WatchlistHitBadge: React.FC<{
	hits: unknown[];
}> = ({ hits }) => {
	let variant: BadgeProps["variant"] = "error";
	let IconComponent: typeof ExclamationCircleIcon = ExclamationCircleIcon;
	let text = `${hits.length} Hit${hits.length === 1 ? "" : "s"}`;

	if (hits.length === 0) {
		variant = "success";
		IconComponent = CheckCircleIcon;
		text = "No Hits";
	}

	return (
		<VerificationBadge variant={variant}>
			<IconComponent />
			{text}
		</VerificationBadge>
	);
};
