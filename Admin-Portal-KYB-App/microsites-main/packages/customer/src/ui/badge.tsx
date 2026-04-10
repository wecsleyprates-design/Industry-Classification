import * as React from "react";
import {
	CheckCircleIcon,
	ClockIcon,
	EllipsisHorizontalCircleIcon,
	ExclamationCircleIcon,
	InformationCircleIcon,
} from "@heroicons/react/24/outline";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const sharedBadgeClassName = `
  inline-flex
  items-center
  gap-1
  rounded-md
  px-2
  py-1
  text-xs
  font-medium
  transition-colors
  focus:outline-none
  focus:ring-2
  focus:ring-ring
  focus:ring-offset-2
  h-7
  [&>svg]:h-5
  [&>svg]:w-5
  min-w-max
`;

// General purpose Badge
export const badgeVariants = cva(sharedBadgeClassName, {
	variants: {
		variant: {
			default: "bg-primary text-primary-foreground shadow",
			secondary: "bg-secondary text-secondary-foreground",
			destructive: "bg-destructive text-destructive-foreground shadow",
			outline: "text-foreground",
			success: "bg-green-100 text-green-800",
			error: "bg-red-100 text-red-800",
			warning: "bg-yellow-100 text-yellow-800",
			info: "bg-blue-100 text-blue-800",
		},
	},
	defaultVariants: {
		variant: "default",
	},
});

// Case status Badge with custom colors
export const caseStatusBadgeVariants = cva(sharedBadgeClassName, {
	variants: {
		variant: {
			"manually-rejected": "bg-red-100 text-red-800",
			"auto-rejected": "bg-red-100 text-red-800",
			"auto-approved": "bg-green-100 text-green-800",
			"manually-approved": "bg-green-100 text-green-800",
			"needs-review": "bg-yellow-100 text-yellow-800",
			"information-requested": "bg-blue-100 text-blue-800",
			"pending-decision": "bg-yellow-100 text-yellow-800",
			submitted: "bg-blue-100 text-blue-800",
			"score-generated": "bg-blue-100 text-blue-800",
			created: "bg-blue-100 text-blue-800",
			archived: "bg-gray-100 text-gray-800",
			"information-updated": "bg-blue-100 text-blue-800",
			onboarding: "bg-blue-100 text-blue-800",
			"risk-alert": "bg-red-100 text-red-800",
			investigating: "bg-yellow-100 text-yellow-800",
			dismissed: "bg-gray-100 text-gray-800",
			escalated: "bg-yellow-100 text-yellow-800",
			paused: "bg-yellow-100 text-yellow-800",
			"under-manual-review": "bg-yellow-100 text-yellow-800",
			active: "bg-green-100 text-green-800",
			invited: "bg-yellow-100 text-yellow-800",
			"invite-expired": "bg-red-100 text-red-800",
			inactive: "bg-[#F3F4F6] text-[#374151]",
		},
	},
	defaultVariants: {
		variant: "created",
	},
});

export interface BadgeProps
	extends
		React.HTMLAttributes<HTMLDivElement>,
		VariantProps<typeof badgeVariants> {}

export interface CaseStatusBadgeProps
	extends
		React.HTMLAttributes<HTMLDivElement>,
		VariantProps<typeof caseStatusBadgeVariants> {
	label: string;
}

// Simple Badge
export function Badge({ className, variant, ...props }: BadgeProps) {
	return (
		<div className={cn(badgeVariants({ variant }), className)} {...props} />
	);
}

// CaseStatusBadge with correct icons, colors, and labels
export function CaseStatusBadge({
	className,
	variant,
	label,
	...props
}: CaseStatusBadgeProps) {
	// Icon mapping
	const statusIconMap: Record<string, React.ElementType> = {
		active: CheckCircleIcon,
		invited: ClockIcon,
		"invite-expired": ExclamationCircleIcon,
		"under-manual-review": ExclamationCircleIcon,
		"manually-rejected": ExclamationCircleIcon,
		"auto-rejected": ExclamationCircleIcon,
		submitted: CheckCircleIcon,
		"score-generated": CheckCircleIcon,
		"manually-approved": CheckCircleIcon,
		"auto-approved": CheckCircleIcon,
		"information-requested": EllipsisHorizontalCircleIcon,
		created: EllipsisHorizontalCircleIcon,
		onboarding: EllipsisHorizontalCircleIcon,
		"pending-decision": ClockIcon,
		default: InformationCircleIcon,
	};

	const Icon = statusIconMap[variant ?? "default"] || InformationCircleIcon;

	// Format label: "INVITE_EXPIRED" -> "Invite Expired"
	function formatCaseStatusLabel(status: string) {
		return status
			.replace(/_/g, " ")
			.toLowerCase()
			.replace(/\b\w/g, (c) => c.toUpperCase());
	}

	return (
		<div
			className={cn(caseStatusBadgeVariants({ variant }), className)}
			{...props}
		>
			<Icon className="w-4 h-4 mr-1.5" />
			{formatCaseStatusLabel(label)}
		</div>
	);
}
