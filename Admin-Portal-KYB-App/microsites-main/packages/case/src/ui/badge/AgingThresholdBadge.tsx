import * as React from "react";
import { cn } from "@/lib/utils";

export function AgingThresholdBadge({
	className,
	label = "",
	color,
	...props
}: React.HTMLAttributes<HTMLDivElement> & {
	label: string;
	color: "red" | "yellow" | "green";
}) {
	function getClasses(color?: "red" | "yellow" | "green") {
		let classes = ``;
		switch (color) {
			case "red":
				classes = classes + "bg-red-100 text-red-700 font-medium";
				break;
			case "yellow":
				classes = classes + "bg-yellow-100 text-yellow-700 font-medium";
				break;
			case "green":
				classes = classes + "bg-green-100 text-green-700 font-medium";
				break;
			default:
				classes = classes + "bg-[#DCFCE7] text-[#15803D] font-medium";
		}
		return classes;
	}

	return (
		<div className={cn(getClasses(color), className)} {...props}>
			{label}
		</div>
	);
}
