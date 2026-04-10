import React from "react";
import { twMerge } from "tailwind-merge";

interface Props {
	headerComponent: React.ReactNode;
	contentComponent: React.ReactNode;
	removeDivider?: boolean;
	className?: string;
	headerClassName?: string;
	contentClassName?: string;
}

const Card: React.FC<Props> = ({
	headerComponent,
	contentComponent,
	removeDivider,
	className,
	headerClassName,
	contentClassName,
}) => {
	return (
		<div
			className={twMerge(
				"rounded-lg bg-white shadow border",
				removeDivider ? "" : "divide-y divide-gray-200",
				className ?? "",
			)}
		>
			<div className={twMerge("px-4 py-5 sm:px-6", headerClassName)}>
				{headerComponent}
			</div>
			<div className={twMerge("px-4 py-5 sm:px-6", contentClassName)}>
				{contentComponent}
			</div>
		</div>
	);
};

export default Card;
