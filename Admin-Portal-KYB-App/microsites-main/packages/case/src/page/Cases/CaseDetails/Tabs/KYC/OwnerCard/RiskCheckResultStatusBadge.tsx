import {
	CheckBadgeIcon,
	CheckCircleIcon,
	ClockIcon,
	ExclamationCircleIcon,
	ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { type RiskStatus } from "@/types/risk";

import { VALUE_NOT_AVAILABLE } from "@/constants";
import { type BadgeProps, VerificationBadge } from "@/ui/badge";
import { Skeleton } from "@/ui/skeleton";
import { Tooltip } from "@/ui/tooltip";

type BadgeVariant = BadgeProps["variant"];
type BadgeIcon = React.ForwardRefExoticComponent<
	React.PropsWithoutRef<React.SVGProps<SVGSVGElement>> & {
		title?: string;
		titleId?: string;
	} & React.RefAttributes<SVGSVGElement>
>;
type BadgeAttributes = {
	variant: BadgeVariant;
	icon: BadgeIcon;
	text: string;
};

// prettier-ignore
const RISK_STATUS_TO_BADGE_ATTRIBUTES = new Map<RiskStatus, BadgeAttributes>([
	["match", { variant: "success", icon: CheckCircleIcon, text: "Match" }],
	["success", { variant: "success", icon: CheckCircleIcon, text: "Match" }],
	["manually_approved", { variant: "success", icon: CheckCircleIcon, text: "Match" }],
	["verified", { variant: "info", icon: CheckBadgeIcon, text: "Verified" }],
	["yes", { variant: "info", icon: CheckBadgeIcon, text: "Verified" }],
	["pending", { variant: "default", icon: ClockIcon, text: "Pending" }],
	["active", { variant: "default", icon: ClockIcon, text: "Pending" }],
	["waiting_for_prerequisite", { variant: "default", icon: ClockIcon, text: "Pending" }],
	["pending_review", { variant: "default", icon: ClockIcon, text: "Pending" }],
	["partial_match", { variant: "warning", icon: ExclamationTriangleIcon, text: "Partial Match" }],
	["no_match", { variant: "error", icon: ExclamationCircleIcon, text: "No Match" }],
	["failed", { variant: "error", icon: ExclamationCircleIcon, text: "Failed" }],
	["expired", { variant: "error", icon: ExclamationCircleIcon, text: "Expired" }],
	["no_data", { variant: "error", icon: ExclamationCircleIcon, text: "No Data" }],
	["no_input", { variant: "error", icon: ExclamationCircleIcon, text: "Not Provided" }],
	["canceled", { variant: "error", icon: ExclamationCircleIcon, text: "Failed" }],
	["manually_rejected", { variant: "error", icon: ExclamationCircleIcon, text: "Failed" }],
	["no", { variant: "error", icon: ExclamationCircleIcon, text: "No" }],
	["error", { variant: "error", icon: ExclamationTriangleIcon, text: "Error" }],
]);

const mapRiskStatusToBadgeAttributes = (
	status: RiskStatus | null | undefined,
): BadgeAttributes => {
	const defaultAttributes: BadgeAttributes = {
		variant: "warning",
		icon: ExclamationTriangleIcon,
		text: "Unverified",
	};

	if (!status) return defaultAttributes;

	return RISK_STATUS_TO_BADGE_ATTRIBUTES.get(status) ?? defaultAttributes;
};

export const RiskCheckResultStatusBadge: React.FC<{
	status: RiskStatus | null | undefined;
	value?: unknown;
	loading?: boolean;
	tooltip?: string | React.ReactNode;
}> = (props) => {
	if (props.loading) {
		return <Skeleton className="w-[76px] h-[26px] ml-auto" />;
	} else if (
		"value" in props &&
		(!props.value || props.value === VALUE_NOT_AVAILABLE)
	) {
		/**
		 * If the actual data point needed for the risk check result was not provided,
		 * short-circuit and return a badge indicating "Not Provided".
		 */
		return (
			<VerificationBadge variant="error">
				<ExclamationCircleIcon className="size-4" />
				Not Provided
			</VerificationBadge>
		);
	}

	const {
		variant,
		icon: IconComponent,
		text,
	} = mapRiskStatusToBadgeAttributes(props.status);

	const derivedTooltip = props.tooltip;

	const badgeElement = (
		<VerificationBadge variant={variant}>
			<IconComponent className="size-4" />
			{text}
		</VerificationBadge>
	);

	if (derivedTooltip) {
		return (
			<Tooltip
				trigger={badgeElement}
				content={derivedTooltip}
				side="bottom"
				align="center"
				sideOffset={8}
				className="p-3"
			/>
		);
	}

	return badgeElement;
};
