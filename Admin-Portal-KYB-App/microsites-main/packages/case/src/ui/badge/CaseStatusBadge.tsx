import React, { useMemo } from "react";
import {
	CheckCircleIcon,
	ClockIcon,
	EllipsisHorizontalCircleIcon,
	ExclamationCircleIcon,
	InformationCircleIcon,
} from "@heroicons/react/24/outline";
import { type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { caseStatusBadgeVariants } from "./Badge";

export interface CaseStatusBadgeProps
	extends
		React.HTMLAttributes<HTMLDivElement>,
		VariantProps<typeof caseStatusBadgeVariants> {
	label: string;
}

const ICON_MAP: [RegExp, React.ComponentType<any>][] = [
	[/rejected|under-manual-review/, ExclamationCircleIcon],
	[/submitted|score-generated|approved/, CheckCircleIcon],
	[/information-requested|created|onboarding/, EllipsisHorizontalCircleIcon],
	[/pending-decision/, ClockIcon],
];

export function CaseStatusBadge({
	className,
	variant,
	label,
	...props
}: CaseStatusBadgeProps) {
	const IconComponent = useMemo(() => {
		if (!variant) return InformationCircleIcon;
		return (
			ICON_MAP.find(([pattern]) => pattern.test(variant))?.[1] ??
			InformationCircleIcon
		);
	}, [variant]);

	return (
		<div
			className={cn(caseStatusBadgeVariants({ variant }), className)}
			{...props}
		>
			<IconComponent className="w-4 h-4 mr-1.5" />
			{label}
		</div>
	);
}
