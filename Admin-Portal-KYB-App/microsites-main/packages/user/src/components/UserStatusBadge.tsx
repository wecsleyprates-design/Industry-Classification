import React from "react";
import {
	CheckCircleIcon,
	ClockIcon,
	ExclamationCircleIcon,
	PauseCircleIcon,
} from "@heroicons/react/24/outline";
import { capitalize } from "@/lib/helper";
import { type User } from "@/types/User";

import { Badge, type BadgeProps } from "@/ui/badge";

type UserStatusBadgeProps = { user: Pick<User, "status"> };
type BadgeConfig = Pick<BadgeProps, "variant"> & {
	icon: typeof CheckCircleIcon;
};

const STATUS_TO_BADGE_MAP: Record<User["status"], BadgeConfig> = {
	ACTIVE: { variant: "success", icon: CheckCircleIcon },
	INACTIVE: { variant: "warning", icon: PauseCircleIcon },
	INVITED: { variant: "warning", icon: ClockIcon },
	SIGNUP_PENDING: { variant: "warning", icon: ClockIcon },
	INVITE_EXPIRED: { variant: "expired", icon: ExclamationCircleIcon },
	INVITATION_REQUESTED: { variant: "warning", icon: ClockIcon },
};

const DEFAULT_BADGE_CONFIG = STATUS_TO_BADGE_MAP.ACTIVE;

export const UserStatusBadge: React.FC<UserStatusBadgeProps> = ({ user }) => {
	const { variant, icon: Icon } =
		STATUS_TO_BADGE_MAP[user.status] ?? DEFAULT_BADGE_CONFIG;

	return (
		<Badge variant={variant}>
			<Icon />
			{capitalize(user.status)}
		</Badge>
	);
};
