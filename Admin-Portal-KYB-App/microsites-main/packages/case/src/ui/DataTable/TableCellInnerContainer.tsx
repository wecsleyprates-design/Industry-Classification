import React from "react";
import { cn } from "@/lib/utils";

interface TableCellInnerContainerProps {
	children: React.ReactNode;
	isLastColumn: boolean;
}

export const TableCellInnerContainer: React.FC<
	TableCellInnerContainerProps
> = ({ children, isLastColumn }) => {
	return (
		<div
			className={cn(
				"flex items-center",
				isLastColumn ? "justify-end mr-4" : "",
			)}
		>
			{children}
		</div>
	);
};
