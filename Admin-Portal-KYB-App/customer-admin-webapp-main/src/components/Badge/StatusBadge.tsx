import React, { useId } from "react";
import {
	CheckBadgeIcon,
	CheckCircleIcon,
	ClockIcon,
	CreditCardIcon,
	ExclamationCircleIcon,
	ExclamationTriangleIcon,
	InformationCircleIcon,
	UserCircleIcon,
	XCircleIcon,
} from "@heroicons/react/24/outline";
import SpiralIcon from "@/assets/svg/SpiralIcon";
import { ReactCustomTooltip } from "@/components/Tooltip";
import Badge from "./Badge";

export type Ttype =
	| "green_clock"
	| "green_tick"
	| "red_exclamation_triangle"
	| "red_cross"
	| "red_exclamation_circle"
	| "gray_exclamation_circle"
	| "red_card"
	| "yellow_clock"
	| "gray_clock"
	| "warning"
	| "yellow_spiral"
	| "grey_user"
	| "inactive"
	| "active"
	| "blue_info"
	| "yellow_info"
	| "yellow_clock_bg"
	| "blue_tick"
	| "gray_info";

type TStatusBadge = {
	icon?: React.ReactElement;
	text: string;
	type: Ttype;
	className?: string;
	tooltip?: string;
};

function getClasses(type: Ttype) {
	let classes = `
inline-flex items-center gap-x-0.5 mr-1 rounded-md px-2 py-1 text-xs font-medium
  `;
	switch (type) {
		case "green_clock":
			classes = classes + "text-green-700 bg-green-50";
			break;
		case "green_tick":
			classes = classes + "text-green-700 bg-green-50";
			break;
		case "red_exclamation_triangle":
			classes = classes + "text-red-600 bg-red-50";
			break;
		case "yellow_clock":
			classes = classes + "text-[#C89C00] bg-white";
			break;
		case "gray_clock":
			classes = classes + "text-gray-700 bg-gray-100";
			break;
		case "warning":
			classes = classes + "text-yellow-600 bg-yellow-50";
			break;
		case "red_cross":
			classes = classes + "text-red-600 bg-red-50";
			break;
		case "red_exclamation_circle":
			classes = classes + "text-red-700 bg-red-50";
			break;
		case "gray_exclamation_circle":
			classes = classes + "text-gray-700 bg-gray-100";
			break;
		case "grey_user":
			classes = classes + "text-[#757575] bg-white";
			break;
		case "red_card":
			classes = classes + "text-red-600 bg-red-50 ";
			break;
		case "yellow_spiral":
			classes = classes + "text-[#C89C00] bg-white";
			break;
		case "inactive":
			classes = classes + "bg-gray-100 text-gray-700";
			break;
		case "active":
			classes = classes + "bg-green-100 text-green-700";
			break;
		case "blue_info":
			classes = classes + "text-blue-700 bg-blue-100";
			break;
		case "yellow_info":
			classes = classes + "text-yellow-700 bg-yellow-100";
			break;
		case "yellow_clock_bg":
			classes = classes + "text-[#C89C00] bg-yellow-100";
			break;
		case "blue_tick":
			classes = classes + "text-blue-700 bg-blue-100";
			break;
		case "gray_info":
			classes = classes + "text-gray-700 bg-gray-100";
			break;
		default:
			classes = classes + "text-green-700 bg-green-50";
			break;
	}

	return classes;
}

function getIcon(type: Ttype) {
	switch (type) {
		case "green_clock":
			return (
				<span>
					<ClockIcon className="-ml-0.5 h-4 w-4" aria-hidden="true" />
				</span>
			);
		case "green_tick":
			return (
				<span>
					<CheckCircleIcon className="-ml-0.5 h-4 w-4" aria-hidden="true" />
				</span>
			);
		case "red_exclamation_triangle":
			return (
				<span>
					<ExclamationTriangleIcon
						className="-ml-0.5 h-4 w-4"
						aria-hidden="true"
					/>
				</span>
			);
		case "yellow_clock":
			return (
				<span>
					<ClockIcon className="-ml-0.5 h-4 w-4" aria-hidden="true" />
				</span>
			);
		case "gray_clock":
			return (
				<span>
					<ClockIcon className="-ml-0.5 h-4 w-4" aria-hidden="true" />
				</span>
			);
		case "warning":
			return (
				<span>
					<ExclamationTriangleIcon
						className="-ml-0.5 h-4 w-4"
						aria-hidden="true"
					/>
				</span>
			);
		case "red_exclamation_circle":
			return (
				<span>
					<ExclamationCircleIcon
						className="-ml-0.5 h-4 w-4"
						aria-hidden="true"
					/>
				</span>
			);
		case "gray_exclamation_circle":
			return (
				<span>
					<ExclamationCircleIcon
						className="-ml-0.5 h-4 w-4"
						aria-hidden="true"
					/>
				</span>
			);
		case "grey_user":
			return (
				<span>
					<UserCircleIcon className="-ml-0.5 h-4 w-4" aria-hidden="true" />
				</span>
			);
		case "red_card":
			return (
				<span>
					<CreditCardIcon className="-ml-0.5 h-4 w-4" aria-hidden="true" />
				</span>
			);
		case "yellow_spiral":
			return (
				<span>
					<SpiralIcon aria-hidden="true" />
				</span>
			);
		case "red_cross":
			return (
				<span>
					<XCircleIcon className="-ml-0.5 h-4 w-4" aria-hidden="true" />
				</span>
			);
		case "inactive":
			return <></>;
		case "active":
			return <></>;
		case "blue_info":
			return (
				<span>
					<InformationCircleIcon
						className="-ml-0.5 h-4 w-4"
						aria-hidden="true"
					/>
				</span>
			);
		case "yellow_info":
			return (
				<span>
					<InformationCircleIcon
						className="-ml-0.5 h-4 w-4"
						aria-hidden="true"
					/>
				</span>
			);
		case "yellow_clock_bg":
			return (
				<span>
					<ClockIcon className="-ml-0.5 h-4 w-4" aria-hidden="true" />
				</span>
			);
		case "blue_tick":
			return (
				<span>
					<CheckBadgeIcon className="-ml-0.5 h-4 w-4" aria-hidden="true" />
				</span>
			);
		case "gray_info":
			return (
				<span>
					<InformationCircleIcon
						className="-ml-0.5 h-4 w-4"
						aria-hidden="true"
					/>
				</span>
			);
		default:
			return (
				<span>
					<ClockIcon className="-ml-0.5 h-4 w-4" aria-hidden="true" />
				</span>
			);
	}
}

const StatusBadge: React.FC<TStatusBadge> = ({
	icon,
	text,
	type,
	className,
	tooltip,
}) => {
	const tooltipId = useId();
	const badgeElement = (
		<Badge
			icon={icon ?? getIcon(type)}
			className={`${getClasses(type)} ${className ?? ""}`}
			text={text ?? ""}
			isRemoveable={false}
		/>
	);

	if (tooltip) {
		return (
			<ReactCustomTooltip
				id={`status-badge-${tooltipId}`}
				tooltip={<span>{tooltip}</span>}
				tooltipStyle={{
					backgroundColor: "#1f2937",
					color: "white",
					fontSize: "12px",
					maxWidth: "250px",
					zIndex: 1000,
				}}
			>
				{badgeElement}
			</ReactCustomTooltip>
		);
	}

	return badgeElement;
};

export default StatusBadge;
