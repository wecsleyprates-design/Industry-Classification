import React, { useState } from "react";
import {
	ClipboardIcon,
	EyeIcon,
	EyeSlashIcon,
} from "@heroicons/react/24/outline";
import { toast } from "sonner";
import { formatLocalDate, getInitials } from "@/lib/utils";
import { Card } from "./card";

import { DATE_FORMATS } from "@/constants";
import { Avatar } from "@/ui/avatar";
import { Badge } from "@/ui/badge";
import { Skeleton } from "@/ui/skeleton";

interface CaseSummaryHeaderProps {
	title?: string;
	dbaName?: string;
	timestamp: string;
	caseId: string;
	businessId?: string;
}

export const CaseSummaryHeader: React.FC<CaseSummaryHeaderProps> = ({
	title,
	dbaName,
	timestamp,
	caseId,
	businessId,
}) => {
	const [showCaseId, setShowCaseId] = useState(false);
	const [showBusinessId, setShowBusinessId] = useState(false);

	const initials = getInitials(title ?? "");
	const formattedDate = timestamp
		? formatLocalDate(timestamp, DATE_FORMATS.MONTH_DAY_YEAR_TIME)
		: null;

	const toggleIdVisibility = (
		setter: React.Dispatch<React.SetStateAction<boolean>>,
	) => {
		setter((prev) => !prev);
	};

	const copyToClipboard = (text: string, label: string) => {
		void navigator.clipboard
			.writeText(text)
			.then(() => {
				toast.success(`${label} copied to clipboard`, {
					duration: 3000,
					position: "bottom-right",
				});
			})
			.catch(() => {
				toast.error(`Failed to copy ${label} to clipboard`, {
					duration: 3000,
					position: "bottom-right",
				});
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
			className={`flex items-center justify-between px-3 py-1 bg-${color}-100 border-1 ${
				show ? "w-auto" : "max-w-[230px]"
			}`}
		>
			<div className="inline-flex items-center gap-2 overflow-hidden">
				<span className={`text-${color}-700 whitespace-nowrap`}>
					{label}
				</span>
				{show ? (
					<span className={`font-medium text-${color}-700 break-all`}>
						{id}
					</span>
				) : null}
			</div>
			<div className="inline-flex items-center flex-shrink-0">
				<button
					onClick={() => {
						toggleIdVisibility(setShow);
					}}
					className="focus:outline-none"
				>
					{show ? (
						<EyeSlashIcon
							className={`h-4 w-4 text-${color}-700`}
							strokeWidth={2}
						/>
					) : (
						<EyeIcon
							className={`h-4 w-4 text-${color}-700`}
							strokeWidth={2}
						/>
					)}
				</button>
				<button
					onClick={() => {
						copyToClipboard(id, label);
					}}
					className="ml-1 focus:outline-none"
				>
					<ClipboardIcon
						className={`h-4 w-4 text-${color}-700`}
						strokeWidth={2}
					/>
				</button>
			</div>
		</Badge>
	);

	const shouldStack = showCaseId || showBusinessId;
	if (!title || !businessId) {
		return (
			<Card>
				<div className="flex items-start p-4 space-x-3">
					<div className="flex-shrink-0">
						<Skeleton className="w-12 h-12 rounded-full" />
					</div>
					<div className="flex-grow">
						<div className="flex flex-col mb-2 space-y-2 sm:hidden">
							<Skeleton className="h-7 w-full max-w-[230px]" />
							<Skeleton className="h-7 w-full max-w-[230px]" />
						</div>
						<Skeleton className="w-48 mb-2 h-7" />
						<Skeleton className="w-32 h-5" />
						<div className="flex-row hidden mt-2 space-x-4 sm:flex">
							<Skeleton className="h-6 w-[150px]" />
							<Skeleton className="h-6 w-[150px]" />
						</div>
					</div>
				</div>
			</Card>
		);
	}

	return (
		<Card>
			<div className="flex items-center p-4 space-x-3">
				<div className="flex-shrink-0">
					<Avatar
						initials={initials}
						size="lg"
						backgroundColor="bg-blue-100"
						textColor="text-blue-700"
					/>
				</div>
				<div className="flex-grow">
					<div className="flex flex-col mb-2 space-y-2 sm:hidden">
						{renderBadge(
							"CASE ID",
							caseId,
							showCaseId,
							setShowCaseId,
							"green",
						)}
						{renderBadge(
							"BUSINESS ID",
							businessId,
							showBusinessId,
							setShowBusinessId,
							"blue",
						)}
					</div>
					{dbaName ? (
						<>
							<h1 className="text-xl font-semibold text-gray-800">
								{dbaName}
							</h1>
							<p className="text-gray-500 text-md">({title})</p>
						</>
					) : (
						<h1 className="text-xl font-semibold text-gray-800">
							{title}
						</h1>
					)}
					<span className="text-sm text-gray-500">
						{formattedDate}
					</span>
					<div
						className={`hidden sm:flex ${
							shouldStack
								? "flex-col space-y-2"
								: "flex-row space-x-4"
						} mt-2`}
					>
						{renderBadge(
							"CASE ID",
							caseId,
							showCaseId,
							setShowCaseId,
							"green",
						)}
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
		</Card>
	);
};
