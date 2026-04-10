import React from "react";
import { cn } from "@/lib/utils";

interface Props {
	headerComponent: React.ReactNode;
	contentComponent: React.ReactNode;
	removeDivider?: boolean;
}

export const Card: React.FC<Props> = ({
	headerComponent,
	contentComponent,
	removeDivider,
}) => {
	return (
		<div
			className={cn(
				"rounded-2xl bg-white",
				removeDivider ? "" : "divide-y divide-gray-200 ",
			)}
		>
			<div className="px-4 py-5 sm:px-6">{headerComponent}</div>
			<div className="px-4 py-5 sm:p-6 ">{contentComponent}</div>
		</div>
	);
};
