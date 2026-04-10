import React from "react";
import { type User } from "@/types/User";

import { Badge, type BadgeProps } from "@/ui/badge";

type UserRoleBadgeProps = { user: Pick<User, "subrole"> };
type BadgeConfig = Pick<BadgeProps, "variant">;

const ROLE_TO_BADGE_MAP: Record<User["subrole"]["code"], BadgeConfig> = {
	owner: { variant: "secondary" },
	risk_analyst: { variant: "info" },
	cro: { variant: "info" },
};

const DEFAULT_BADGE_CONFIG = ROLE_TO_BADGE_MAP.risk_analyst;

export const UserRoleBadge: React.FC<UserRoleBadgeProps> = ({ user }) => {
	const { variant } =
		ROLE_TO_BADGE_MAP[user.subrole?.code] ?? DEFAULT_BADGE_CONFIG;

	return <Badge variant={variant}>{user.subrole?.label}</Badge>;
};
