import React from "react";
import { cn } from "@/lib/utils";

interface IndicatorDotIconProps {
	className?: string;
}

export const IndicatorDotIcon: React.FC<IndicatorDotIconProps> = ({
	className,
}) => (
	<svg
		width="8"
		height="8"
		viewBox="0 0 10 10"
		fill="currentColor"
		className={cn("text-blue-600", className)}
	>
		<circle cx="5" cy="5" r="4" />
	</svg>
);
