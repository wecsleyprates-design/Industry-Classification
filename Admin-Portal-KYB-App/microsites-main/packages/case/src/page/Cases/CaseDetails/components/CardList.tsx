import React, { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export const CardList: React.FC<{
	children: ReactNode;
	borderless?: boolean;
	dividerless?: boolean;
}> = ({ children, borderless = false, dividerless = false }) => {
	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-col">
				<dl
					className={cn(
						!borderless && "border-t border-gray-100",
						!dividerless && "divide-y divide-gray-100",
					)}
				>
					{children}
				</dl>
			</div>
		</div>
	);
};
