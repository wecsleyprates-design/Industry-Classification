import React from "react";
import {
	CheckCircleIcon,
	ClockIcon,
	EllipsisHorizontalCircleIcon,
	ExclamationCircleIcon,
	ExclamationTriangleIcon,
	PauseIcon,
	PlayIcon,
	QuestionMarkCircleIcon,
	UserIcon,
	XCircleIcon,
} from "@heroicons/react/24/outline";
import { capitalize } from "@/lib/helper";

import { type BadgeProps, VerificationBadge } from "@/ui/badge";

interface BusinessStatusBadgeProps {
	status: string;
}

type BadgeConfig = {
	variant: BadgeProps["variant"];
	icon: typeof CheckCircleIcon;
};

const STATUS_TO_BADGE_CONFIG: Record<string, BadgeConfig> = {
	// Green tick statuses - successful/approved states
	AUTO_APPROVED: {
		variant: "success",
		icon: CheckCircleIcon,
	},
	MANUALLY_APPROVED: {
		variant: "success",
		icon: CheckCircleIcon,
	},
	VERIFIED: {
		variant: "success",
		icon: CheckCircleIcon,
	},
	ACCEPTED: {
		variant: "success",
		icon: CheckCircleIcon,
	},
	COMPLETED: {
		variant: "success",
		icon: CheckCircleIcon,
	},
	SUBMITTED: {
		variant: "success",
		icon: CheckCircleIcon,
	},
	DISMISSED: {
		variant: "success",
		icon: CheckCircleIcon,
	},

	// Green clock statuses - in progress/pending positive states
	ONBOARDING: {
		variant: "info",
		icon: ClockIcon,
	},
	SCORE_CALCULATED: {
		variant: "info",
		icon: ClockIcon,
	},

	// Yellow clock statuses - waiting/pending states
	INVITED: {
		variant: "warning",
		icon: ClockIcon,
	},
	INFORMATION_REQUESTED: {
		variant: "warning",
		icon: ClockIcon,
	},
	ESCALATED: {
		variant: "warning",
		icon: ClockIcon,
	},

	// Yellow spiral statuses - processing/review states
	PENDING_DECISION: {
		variant: "warning",
		icon: EllipsisHorizontalCircleIcon,
	},
	INVESTIGATING: {
		variant: "warning",
		icon: EllipsisHorizontalCircleIcon,
	},
	PAUSED: {
		variant: "warning",
		icon: EllipsisHorizontalCircleIcon,
	},

	// Red exclamation triangle statuses - manual review/cancelled states
	UNDER_MANUAL_REVIEW: {
		variant: "error",
		icon: ExclamationTriangleIcon,
	},
	CANCELLED: {
		variant: "error",
		icon: ExclamationTriangleIcon,
	},
	ARCHIVED: {
		variant: "error",
		icon: ExclamationTriangleIcon,
	},
	MANUALLY_REJECTED: {
		variant: "error",
		icon: ExclamationTriangleIcon,
	},

	// Red exclamation circle statuses - alert/error states
	REJECTED: {
		variant: "error",
		icon: ExclamationCircleIcon,
	},
	RISK_ALERT: {
		variant: "error",
		icon: ExclamationCircleIcon,
	},
	check_connection: {
		variant: "error",
		icon: ExclamationCircleIcon,
	},

	// Red cross statuses - expired/failed states
	INVITE_EXPIRED: {
		variant: "error",
		icon: XCircleIcon,
	},
	UNVERIFIED: {
		variant: "error",
		icon: XCircleIcon,
	},
	EXPIRED: {
		variant: "error",
		icon: XCircleIcon,
	},

	// Grey user status - not subscribed
	NOT_SUBSCRIBED: {
		variant: "outline",
		icon: UserIcon,
	},

	// Active/Inactive statuses
	ACTIVE: {
		variant: "success",
		icon: PlayIcon,
	},
	INACTIVE: {
		variant: "secondary",
		icon: PauseIcon,
	},
};

export const BusinessStatusBadge: React.FC<BusinessStatusBadgeProps> = ({
	status,
}) => {
	const badgeConfig = STATUS_TO_BADGE_CONFIG[status] || {
		variant: "secondary" as const,
		icon: QuestionMarkCircleIcon,
	};

	const IconComponent = badgeConfig.icon;

	return (
		<VerificationBadge variant={badgeConfig.variant}>
			<IconComponent />
			{capitalize(status.replace(/_/g, " "))}
		</VerificationBadge>
	);
};
