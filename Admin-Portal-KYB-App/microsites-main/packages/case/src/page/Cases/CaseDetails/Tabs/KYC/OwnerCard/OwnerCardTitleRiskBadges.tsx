import React from "react";
import {
	CheckBadgeIcon,
	ClockIcon,
	ExclamationCircleIcon,
	InformationCircleIcon,
} from "@heroicons/react/24/outline";
import { type BusinessApplicantVerificationResponse } from "@/types/businessEntityVerification";
import { RiskScoreBadge } from "./RiskScoreBadge";

import { Badge, type BadgeProps, VerificationBadge } from "@/ui/badge";

type ApplicantStatus =
	BusinessApplicantVerificationResponse["data"]["applicant"]["status"];
type RiskLevel = "low" | "moderate" | "high";
type IconComponent = React.ForwardRefExoticComponent<
	React.PropsWithoutRef<React.SVGProps<SVGSVGElement>> & {
		title?: string;
		titleId?: string;
	} & React.RefAttributes<SVGSVGElement>
>;

type BadgeConfig = {
	variant: BadgeProps["variant"];
	icon: IconComponent;
	text: string;
	riskLevel: RiskLevel | null;
};

const STATUS_CONFIG: Record<ApplicantStatus, BadgeConfig> = {
	SUCCESS: {
		variant: "info",
		icon: CheckBadgeIcon,
		text: "Verified",
		riskLevel: "low",
	},
	PENDING: {
		variant: "warning",
		icon: ClockIcon,
		text: "Verification Pending",
		riskLevel: "moderate",
	},
	EXPIRED: {
		variant: "warning",
		icon: ExclamationCircleIcon,
		text: "Verification Expired",
		riskLevel: "moderate",
	},
	CANCELED: {
		variant: "warning",
		icon: ExclamationCircleIcon,
		text: "Verification Canceled",
		riskLevel: "moderate",
	},
	FAILED: {
		variant: "error",
		icon: ExclamationCircleIcon,
		text: "Verification Failed",
		riskLevel: "high",
	},
};

const DEFAULT_CONFIG = STATUS_CONFIG.PENDING;

const IDV_DISABLED_CONFIG: BadgeConfig = {
	variant: "secondary",
	icon: InformationCircleIcon,
	text: "Unverified - IDV Disabled",
	riskLevel: null,
};

const VERIFICATION_STALE_CONFIG: BadgeConfig = {
	variant: "warning",
	icon: ExclamationCircleIcon,
	text: "Unverified",
	riskLevel: null,
};

export const OwnerCardTitleRiskBadges: React.FC<{
	verificationData?:
		| BusinessApplicantVerificationResponse["data"]
		| undefined;
	isControl?: boolean;
	/** When true, overrides the verification status to show "Unverified" */
	isVerificationStale?: boolean;
}> = ({ verificationData, isControl, isVerificationStale = false }) => {
	const isIDVEnabled =
		verificationData?.identity_verification_attempted ?? true;
	const applicantStatus = verificationData?.applicant?.status;

	let badgeConfig: BadgeConfig = DEFAULT_CONFIG;

	if (isVerificationStale) {
		// Override to show "Unverified" when inline edits have been made
		badgeConfig = VERIFICATION_STALE_CONFIG;
	} else if (!isIDVEnabled) {
		badgeConfig = IDV_DISABLED_CONFIG;
	} else if (applicantStatus) {
		badgeConfig = STATUS_CONFIG[applicantStatus] || DEFAULT_CONFIG;
	}

	const { variant, icon: IconComponent, text, riskLevel } = badgeConfig;

	// Hide risk score badge if verification is still pending
	const isRiskScoreBadgeVisible =
		applicantStatus && applicantStatus !== "PENDING" && riskLevel !== null;

	return (
		<div className="flex ml-0 space-x-2">
			<VerificationBadge variant={variant}>
				<IconComponent className="size-4" />
				{text}
			</VerificationBadge>
			{isRiskScoreBadgeVisible && <RiskScoreBadge level={riskLevel} />}
			{isControl && <Badge variant="secondary">Control Person</Badge>}
		</div>
	);
};
