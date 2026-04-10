import { type ReactNode, useState } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/solid";

interface ExpandContentProps {
	title: ReactNode;
	children?: ReactNode;
	initialIsExpanded?: boolean;
}

export const ExpandContent = ({
	title,
	children,
	initialIsExpanded = true,
}: ExpandContentProps) => {
	const [isExpanded, setIsExpanded] = useState(initialIsExpanded);

	return (
		<div className="flex flex-col gap-3">
			<button
				type="button"
				className="flex w-full items-center gap-2 text-left cursor-pointer"
				aria-expanded={isExpanded}
				onClick={() => {
					setIsExpanded((prev) => !prev);
				}}
			>
				{title}
				<div className="flex items-center">
					{isExpanded ? (
						<ChevronUpIcon className="w-5 h-5 text-gray-400" />
					) : (
						<ChevronDownIcon className="w-5 h-5 text-gray-400" />
					)}
				</div>
			</button>
			{isExpanded && children}
		</div>
	);
};
