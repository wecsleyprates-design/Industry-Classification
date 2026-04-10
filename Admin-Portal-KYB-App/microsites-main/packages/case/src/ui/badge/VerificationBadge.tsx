import React from "react";
import { usePermission } from "@/hooks/usePermission";
import { Badge, type BadgeProps } from "../badge";

export type VerificationBadgeProps = BadgeProps;

/**
 * Equivalent to the Badge component, but renders null if the user does not have permission to display badges.
 */
export const VerificationBadge: React.FC<VerificationBadgeProps> = (props) => {
	const canDisplayBadges = usePermission("case:read:badge_display");
	if (!canDisplayBadges) return null;
	return <Badge {...props} />;
};
