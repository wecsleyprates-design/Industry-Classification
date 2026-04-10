import React from "react";
import {
	CheckCircleIcon,
	ExclamationTriangleIcon,
	InformationCircleIcon,
	XCircleIcon,
} from "@heroicons/react/24/outline";
import { twMerge } from "tailwind-merge";

interface IBanner {
	children: React.ReactNode;
	type:
		| "error"
		| "warning"
		| "info"
		| "success"
		| "info-yellow"
		| "info-red"
		| "info-blue";
	className?: string;
}
const Banner: React.FC<IBanner> = ({
	children,
	type = "warning",
	className,
}) => {
	const renderIcon = () => {
		switch (type) {
			case "error":
				return (
					<XCircleIcon
						height={18}
						width={18}
						color="#B91C1C"
						className="min-w-fit"
					/>
				);
			case "warning":
				return (
					<ExclamationTriangleIcon
						height={18}
						width={18}
						color="#A16207"
						className="min-w-fit"
					/>
				);
			// TODO: implement below icons
			case "info":
				return (
					<InformationCircleIcon height={18} width={18} className="min-w-fit" />
				);
			case "info-yellow":
				return (
					<InformationCircleIcon
						height={18}
						width={18}
						className="text-yellow-700 min-w-fit"
					/>
				);
			case "success":
				return <CheckCircleIcon height={18} width={18} className="min-w-fit" />;
			case "info-blue":
			case "info-red":
				return <></>;
			default:
				return null;
		}
	};

	const getBgColor = () => {
		switch (type) {
			case "error":
				return "bg-red-100";
			case "warning":
				return "bg-yellow-100";
			case "info":
				return "bg-gray-100";
			case "info-yellow":
				return "bg-yellow-100";
			case "info-red":
				return "bg-red-100";
			case "info-blue":
				return "bg-blue-100";
			default:
				return "bg-yellow-100";
		}
	};
	return (
		<div
			className={twMerge(
				"relative isolate flex items-start gap-x-4 overflow-hidden px-4 py-3 sm:px-3.5 rounded-xl",
				getBgColor(),
				className,
			)}
			role="alert"
		>
			{renderIcon()}
			{children}
		</div>
	);
};

export default Banner;
