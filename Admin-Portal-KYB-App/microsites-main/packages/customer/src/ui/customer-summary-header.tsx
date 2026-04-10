import React, { useState } from "react";
import {
	ClipboardIcon,
	EyeIcon,
	EyeSlashIcon,
} from "@heroicons/react/24/outline";
import dayjs from "dayjs";
import { toast } from "sonner";
import { getInitials } from "@/lib/utils";
import { Card } from "./card";

import { Avatar } from "@/ui/avatar";
import { Badge } from "@/ui/badge";
import { Skeleton } from "@/ui/skeleton";

interface CustomerSummaryHeaderProps {
	businessName?: string;
	timestamp: string | Date;
	customerId: string;
}

export const CustomerSummaryHeader: React.FC<CustomerSummaryHeaderProps> = ({
	businessName,
	timestamp,
	customerId,
}) => {
	const [showCustomerId, setShowCustomerId] = useState(false);

	const initials = getInitials(businessName ?? "");
	const formattedDate = timestamp
		? dayjs(timestamp).format("MM/DD/YYYY, h:mm A")
		: null;

	const toggleIdVisibility = () => {
		setShowCustomerId((prev) => !prev);
	};

	const copyToClipboard = (text: string) => {
		void navigator.clipboard
			.writeText(text)
			.then(() => {
				toast.success("Customer ID Copied", {
					duration: 3000,
					position: "bottom-right",
				});
			})
			.catch(() => {
				toast.error("Failed to copy to clipboard", {
					duration: 3000,
					position: "bottom-right",
				});
			});
	};

	const colorClasses = {
		green: {
			bg: "bg-green-100",
			text: "text-green-700",
		},
		blue: {
			bg: "bg-blue-100",
			text: "text-blue-700",
		},
	};

	const renderBadge = (
		label: string,
		id: string,
		show: boolean,
		color: "green" | "blue",
	) => (
		<Badge
			variant="outline"
			className={`flex items-center justify-between px-3 py-1 ${
				colorClasses[color].bg
			} border-1 ${show ? "w-auto" : "max-w-[230px]"}`}
		>
			<div className="inline-flex items-center gap-2 overflow-hidden">
				<span className={`${colorClasses[color].text} whitespace-nowrap`}>
					{label}
				</span>
				{show && (
					<span className={`font-medium ${colorClasses[color].text} break-all`}>
						{id}
					</span>
				)}
			</div>
			<div className="inline-flex items-center flex-shrink-0">
				<button
					onClick={() => {
						toggleIdVisibility();
					}}
					className="focus:outline-none"
				>
					{show ? (
						<EyeSlashIcon
							className={`h-4 w-4 ${colorClasses[color].text}`}
							strokeWidth={2}
						/>
					) : (
						<EyeIcon
							className={`h-4 w-4 ${colorClasses[color].text}`}
							strokeWidth={2}
						/>
					)}
				</button>
				<button
					onClick={() => {
						copyToClipboard(id);
					}}
					className="ml-1 focus:outline-none"
				>
					<ClipboardIcon
						className={`h-4 w-4 ${colorClasses[color].text}`}
						strokeWidth={2}
					/>
				</button>
			</div>
		</Badge>
	);

	if (!businessName) {
		return (
			<Card>
				<div className="flex items-start p-4 space-x-3">
					<div className="flex-shrink-0">
						<Skeleton className="w-12 h-12 rounded-full" />
					</div>
					<div className="flex-grow">
						<Skeleton className="w-48 mb-2 h-7" />
						<Skeleton className="w-32 h-5 mb-3" />
						<Skeleton className="h-6 w-[150px]" />
					</div>
				</div>
			</Card>
		);
	}

	return (
		<Card>
			<div className="flex items-start p-4 space-x-3">
				<div className="flex-shrink-0">
					<Avatar
						initials={initials}
						size="lg"
						backgroundColor="bg-blue-100"
						textColor="text-blue-700"
					/>
				</div>
				<div className="flex-grow">
					<h1 className="text-xl font-semibold text-gray-800">
						{businessName}
					</h1>
					<span className="text-sm text-gray-500">{formattedDate}</span>
					<div className="flex mt-2">
						{renderBadge("CUSTOMER ID", customerId, showCustomerId, "blue")}
					</div>
				</div>
			</div>
		</Card>
	);
};
