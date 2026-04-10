import {
	CheckCircleIcon,
	EllipsisHorizontalCircleIcon,
	ExclamationCircleIcon,
	InformationCircleIcon,
} from "@heroicons/react/24/outline";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const badgeVariants = cva(
	"inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
	{
		variants: {
			variant: {
				default: "border-transparent bg-primary text-primary-foreground shadow",
				secondary: "border-transparent bg-secondary text-secondary-foreground",
				destructive:
					"border-transparent bg-destructive text-destructive-foreground shadow",
				outline: "text-foreground",
				success: "border-transparent bg-green-100 text-green-800",
				error: "border-transparent bg-red-100 text-red-800",
				warning: "border-transparent bg-yellow-100 text-yellow-800",
				info: "border-transparent bg-blue-100 text-blue-800",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

export const caseStatusBadgeVariants = cva(
	"inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold w-fit",
	{
		variants: {
			variant: {
				"manually-rejected": "bg-red-100 text-red-800",
				"auto-rejected": "bg-red-100 text-red-800",
				"auto-approved": "bg-green-100 text-green-800",
				"manually-approved": "bg-green-100 text-green-800",
				"needs-review": "bg-yellow-100 text-yellow-800",
				"info-requested": "bg-blue-100 text-blue-800",
				"pending-decision": "bg-blue-100 text-blue-800",
				submitted: "bg-blue-100 text-blue-800",
				"score-generated": "bg-blue-100 text-blue-800",
				created: "bg-blue-100 text-blue-800",
				archived: "bg-gray-100 text-gray-800",
				"information-updated": "bg-blue-100 text-blue-800",
				onboarding: "bg-green-100 text-green-800",
				"risk-alert": "bg-red-100 text-red-800",
				investigating: "bg-yellow-100 text-yellow-800",
				dismissed: "bg-gray-100 text-gray-800",
				escalated: "bg-yellow-100 text-yellow-800",
				paused: "bg-yellow-100 text-yellow-800",
				"under-manual-review": "bg-yellow-100 text-yellow-800",
			},
		},
		defaultVariants: {
			variant: "created",
		},
	},
);

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

export function Badge({ className, variant, ...props }: BadgeProps) {
	return (
		<div className={cn(badgeVariants({ variant }), className)} {...props} />
	);
}

export function CaseStatusBadge({
	className,
	variant,
	label,
	...props
}: CaseStatusBadgeProps) {
	const Icon =
		variant?.includes("rejected") ||
		variant === "needs-review" ||
		variant === "under-manual-review"
			? ExclamationCircleIcon
			: variant?.includes("approved") ||
				  variant === "submitted" ||
				  variant === "score-generated"
				? CheckCircleIcon
				: variant === "info-requested" ||
					  variant === "pending-decision" ||
					  variant === "created" ||
					  variant === "onboarding"
					? EllipsisHorizontalCircleIcon
					: InformationCircleIcon;

	return (
		<div
			className={cn(caseStatusBadgeVariants({ variant }), className)}
			{...props}
		>
			<Icon className="w-4 h-4 mr-1.5" /> {/* Updated icon size and margin */}
			{label}
		</div>
	);
}
