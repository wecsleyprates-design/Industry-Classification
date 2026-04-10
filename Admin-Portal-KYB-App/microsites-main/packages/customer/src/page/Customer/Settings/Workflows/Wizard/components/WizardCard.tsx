import React from "react";
import { cn } from "@/lib/utils";

interface WizardCardProps extends React.HTMLAttributes<HTMLDivElement> {
	children: React.ReactNode;
	noPadding?: boolean;
}

export const WizardCard: React.FC<WizardCardProps> = ({
	children,
	className,
	noPadding = false,
	...props
}) => {
	return (
		<div
			className={cn(
				"bg-white border border-gray-200 rounded-xl shadow-sm",
				!noPadding && "p-6",
				className,
			)}
			{...props}
		>
			{children}
		</div>
	);
};
