"use client";

import { useState } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/20/solid";

export default function Cards({
	title,
	subtitle,
	badge,
	children,
	disabled = false,
	disabledText,
}: {
	title: string;
	subtitle: string;
	badge?: string;
	children?: React.ReactNode;
	disabled?: boolean;
	disabledText?: string;
	// setTabValue is passed through from ConfigCard but not used in Cards component
	// It's kept in the type definition for consistency with parent component interface
	setTabValue?: (tab: "admin" | "features") => void;
}) {
	const [open, setOpen] = useState(true);

	return (
		<div
			className={`w-full bg-white border border-[#E5E7EB] rounded-xl ${
				disabled ? "opacity-60 cursor-not-allowed" : ""
			}`}
		>
			{/* Header */}
			<div
				className={`w-full h-[84px] flex items-center justify-between border-b border-[#E5E7EB] px-6 py-5 rounded-t-lg ${
					disabled ? "" : "cursor-pointer"
				}`}
				onClick={() => {
					if (!disabled) {
						setOpen((prev) => !prev);
					}
				}}
			>
				<div className="flex items-center gap-4">
					{/* Chevron toggle */}
					<div className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded-full">
						{open && !disabled ? (
							<ChevronUpIcon className="w-5 h-5 text-gray-600 transition-all duration-300" />
						) : (
							<ChevronDownIcon className="w-5 h-5 text-gray-600 transition-all duration-300" />
						)}
					</div>

					<div className="flex flex-col">
						<p className="text-base font-medium text-gray-900">{title}</p>
						<p className="text-sm text-gray-600">{subtitle}</p>
					</div>
				</div>

				{disabled ? (
					<span className="px-4 py-2 text-xs font-semibold text-yellow-800 bg-yellow-100 rounded-full">
						{disabledText ?? "Currently only available for Admin Roles"}
					</span>
				) : (
					badge && (
						<span className="w-[110px] h-[32px] flex items-center justify-center rounded-full bg-gray-100 text-gray-700 text-xs font-semibold px-[16px] py-[10px]">
							{badge}
						</span>
					)
				)}
			</div>

			{!disabled && open && <div className="p-6">{children}</div>}
		</div>
	);
}
