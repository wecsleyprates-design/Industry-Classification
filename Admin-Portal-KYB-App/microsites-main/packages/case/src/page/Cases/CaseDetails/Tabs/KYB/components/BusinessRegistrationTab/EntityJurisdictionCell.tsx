import React from "react";

import { VALUE_NOT_AVAILABLE } from "@/constants";
import { Badge } from "@/ui/badge";

const JURISDICTION_CONFIG = {
	domestic: { displayLabel: "Domestic", badgeLabel: "Primary" },
	foreign: { displayLabel: "Foreign", badgeLabel: "Secondary" },
};

export interface EntityJurisdictionCellProps {
	foreignDomestic: "domestic" | "foreign" | undefined;
}

export const EntityJurisdictionCell: React.FC<EntityJurisdictionCellProps> = ({
	foreignDomestic,
}) => {
	if (!foreignDomestic) {
		return <span>{VALUE_NOT_AVAILABLE}</span>;
	}

	const { displayLabel, badgeLabel } = JURISDICTION_CONFIG[foreignDomestic];

	return (
		<div className="flex w-full items-center justify-between gap-2">
			<span>{displayLabel}</span>
			<Badge
				variant="secondary"
				className="gap-1 whitespace-nowrap shrink-0 cursor-default"
			>
				{badgeLabel}
			</Badge>
		</div>
	);
};
