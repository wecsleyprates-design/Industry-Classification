import { type HTMLAttributes } from "react";
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
`;

export const badgeVariants = cva(sharedBadgeClassName, {
	variants: {
		variant: {
			default: "bg-primary text-primary-foreground",
			secondary: "bg-secondary text-secondary-foreground",
			destructive: "bg-destructive text-destructive-foreground",
			outline: "text-foreground",
			success: "bg-green-100 text-green-800",
			error: "bg-red-100 text-red-800",
			warning: "bg-yellow-100 text-yellow-800",
			expired: "bg-red-100 text-red-800",
			info: "bg-blue-100 text-blue-800",
		},
	},
	defaultVariants: {
		variant: "default",
	},
});

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
			"invite-expired": "bg-red-100 text-red-800",
		},
	},
	defaultVariants: {
		variant: "created",
	},
});

export interface BadgeProps
	extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export interface CaseStatusBadgeProps
	extends
		HTMLAttributes<HTMLDivElement>,
		VariantProps<typeof caseStatusBadgeVariants> {
	label: string;
}

export function Badge({ className, variant, ...props }: BadgeProps) {
	return (
		<div className={cn(badgeVariants({ variant }), className)} {...props} />
	);
}
