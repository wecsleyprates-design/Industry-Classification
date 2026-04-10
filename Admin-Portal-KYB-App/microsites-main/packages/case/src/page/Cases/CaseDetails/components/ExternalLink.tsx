import React, { type ReactNode } from "react";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";

export const ExternalLink: React.FC<{
	href: string;
	children: ReactNode;
	icon?: typeof ArrowTopRightOnSquareIcon;
}> = ({ href, children, icon = ArrowTopRightOnSquareIcon }) => {
	const IconComponent = icon;
	return (
		<span className="flex items-center">
			<a
				target="_blank"
				href={href}
				rel="noopener noreferrer"
				className="flex flex-row items-center text-sm font-medium text-blue-600"
			>
				<span className="truncate">{children ?? href}</span>
				<IconComponent className="h-4 ml-2 mr-1 text-blue-600 min-w-4" />
			</a>
		</span>
	);
};
