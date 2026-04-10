import React, { type ReactNode } from "react";
import type { FieldSource } from "./fieldSource.types";

import { Tooltip } from "@/ui/tooltip";

function formatTimestamp(iso: string): string {
	const date = new Date(iso);
	return date.toLocaleDateString("en-US", {
		month: "2-digit",
		day: "2-digit",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	});
}

function buildTooltipContent(source: FieldSource): ReactNode {
	if (source.type === "system") {
		return (
			<div className="flex flex-col gap-0.5 text-xs">
				<span>System generated</span>
			</div>
		);
	}

	const label =
		source.type === "applicant"
			? "Applicant"
			: (source.userName ?? "Internal User");
	const roleTag = source.type === "applicant" ? "Applicant" : "Internal";
	const prefix = source.type === "applicant" ? "Provided by" : "Edited by";

	const nameLine = source.userName
		? `${prefix} ${source.userName} (${roleTag})`
		: `${prefix} ${label}`;

	return (
		<div className="flex flex-col gap-0.5 text-xs">
			<span>{nameLine}</span>
			{source.timestamp && (
				<span>on {formatTimestamp(source.timestamp)}</span>
			)}
		</div>
	);
}

const BORDER_MAP: Record<string, string> = {
	applicant: "border-l-2 border-yellow-400",
	internal: "border-l-2 border-blue-400",
};

export const FieldSourceIndicator: React.FC<{
	source: FieldSource;
	children: ReactNode;
}> = ({ source, children }) => {
	const border = BORDER_MAP[source.type];

	return (
		<Tooltip
			trigger={
				<span
					className={`inline-block text-sm font-normal text-gray-800 ${border ?? ""} w-fit py-1 pr-1 pl-2 -m-1`}
				>
					{children}
				</span>
			}
			content={buildTooltipContent(source)}
			side="top"
			align="start"
		/>
	);
};
