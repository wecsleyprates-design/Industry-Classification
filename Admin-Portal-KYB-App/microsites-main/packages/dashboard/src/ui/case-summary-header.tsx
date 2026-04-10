import React, { useState } from "react";
import {
	ClipboardIcon,
	EyeIcon,
	EyeSlashIcon,
} from "@heroicons/react/24/outline";
import dayjs from "dayjs";
import { toast } from "sonner";
import { getInitials } from "@/lib/utils";

import { Avatar } from "@/ui/avatar";
import { Badge } from "@/ui/badge";

interface CaseSummaryHeaderProps {
	title: string;
	timestamp: string;
	caseId: string;
	businessId: string;
}

export const CaseSummaryHeader: React.FC<CaseSummaryHeaderProps> = ({
	title,
	timestamp,
	caseId,
	businessId,
}) => {
	const [showCaseId, setShowCaseId] = useState(false);
	const [showBusinessId, setShowBusinessId] = useState(false);

	const initials = getInitials(title);
	const formattedDate = timestamp
		? dayjs(timestamp).format("MM/DD/YY h:mm A")
		: null;

	const toggleIdVisibility = (
		setter: React.Dispatch<React.SetStateAction<boolean>>,
	) => {
		setter((prev) => !prev);
	};

	const copyToClipboard = async (text: string, label: string) => {
		await navigator.clipboard.writeText(text);
		toast.success(`${label} copied to clipboard`, {
			duration: 3000,
			position: "bottom-left",
		});
	};

	const renderBadge = (
		label: string,
		id: string,
		show: boolean,
		setShow: React.Dispatch<React.SetStateAction<boolean>>,
		color: "green" | "blue",
	) => (
		<Badge
			variant="outline"
			className={`flex items-center justify-between px-3 py-1 bg-${color}-100 border-1 max-w-[230px]`}
		>
			<div className="inline-flex items-center gap-2">
				<span className={`text-${color}-700`}>{label}</span>
				<span className={`font-medium text-${color}-700 truncate`}>
					{show ? id : "••••••"}
				</span>
			</div>
			<div className="inline-flex items-center">
				<button
					onClick={() => {
						toggleIdVisibility(setShow);
					}}
					className="ml-1 focus:outline-none flex-shrink-0"
				>
					{show ? (
						<EyeSlashIcon className={`h-4 w-4 text-${color}-700`} />
					) : (
						<EyeIcon className={`h-4 w-4 text-${color}-700`} />
					)}
				</button>
				<button
					onClick={() => {
						void copyToClipboard(id, label);
					}}
					className="ml-1 focus:outline-none flex-shrink-0"
				>
					<ClipboardIcon className={`h-4 w-4 text-${color}-700`} />
				</button>
			</div>
		</Badge>
	);

	return (
		<div className="bg-white p-4 rounded-2xl">
			<div className="flex items-start space-x-3">
				<div className="flex-shrink-0">
					<Avatar
						initials={initials}
						size="lg"
						backgroundColor="bg-blue-100"
						textColor="text-blue-700"
					/>
				</div>
				<div className="flex-grow">
					<div className="flex flex-col space-y-2 mb-2 sm:hidden">
						{renderBadge("CASE ID", caseId, showCaseId, setShowCaseId, "green")}
						{renderBadge(
							"BUSINESS ID",
							businessId,
							showBusinessId,
							setShowBusinessId,
							"blue",
						)}
					</div>
					<h1 className="text-xl font-semibold text-gray-800">{title}</h1>
					<span className="text-sm text-gray-500">{formattedDate}</span>
					<div className="hidden sm:flex space-x-4 mt-2">
						{renderBadge("CASE ID", caseId, showCaseId, setShowCaseId, "green")}
						{renderBadge(
							"BUSINESS ID",
							businessId,
							showBusinessId,
							setShowBusinessId,
							"blue",
						)}
					</div>
				</div>
			</div>
		</div>
	);
};
