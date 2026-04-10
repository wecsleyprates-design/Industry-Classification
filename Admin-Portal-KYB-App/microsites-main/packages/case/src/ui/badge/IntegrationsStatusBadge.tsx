import * as React from "react";
import { ArrowPathIcon } from "@heroicons/react/20/solid";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";
import { caseStatusBadgeVariants } from "./Badge";

export function IntegrationsStatusBadge({
	className,
	isComplete,
	...props
}: React.HTMLAttributes<HTMLDivElement> & { isComplete: boolean | null }) {
	// Return '-' if isComplete is null
	if (isComplete === null) {
		return <>-</>;
	}

	const Icon = isComplete ? CheckCircleIcon : ArrowPathIcon;
	return (
		<div
			className={cn(
				caseStatusBadgeVariants({
					variant: isComplete ? "created" : "dismissed",
				}),
				className,
			)}
			{...props}
		>
			<Icon className="w-3 h-3" />
			{isComplete ? "Complete" : "Processing"}
		</div>
	);
}
