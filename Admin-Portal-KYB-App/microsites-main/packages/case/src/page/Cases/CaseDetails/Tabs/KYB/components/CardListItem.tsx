import React from "react";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { DisplayFieldValue } from "../../../components/DisplayFieldValue";
import type { FieldSource } from "../../../components/fieldSource.types";

import { Tooltip } from "@/ui/tooltip";

export interface CardListItemProps {
	title?: string;
	label?: string;
	value: React.ReactNode;
	fieldSource?: FieldSource;
	labelTooltip?: React.ReactNode;
}

export const CardListItem: React.FC<CardListItemProps> = ({
	title,
	label,
	value,
	fieldSource,
	labelTooltip,
}) => {
	const displayLabel = title ?? label ?? "";
	const labelContent = labelTooltip ? (
		<Tooltip
			trigger={
				<span className="flex flex-row items-center gap-1">
					{displayLabel}
					<InformationCircleIcon className="text-gray-800 size-4" />
				</span>
			}
			content={
				<span className="whitespace-pre-line">{labelTooltip}</span>
			}
		/>
	) : (
		displayLabel
	);
	return (
		<div className="py-4 sm:flex sm:flex-row sm:gap-4 justify-between items-start">
			<dt className="text-sm font-medium text-gray-500 w-1/2 shrink-0">
				{labelContent}
			</dt>
			<dd className="w-full mt-1 text-sm text-gray-900 sm:mt-0 grow">
				<DisplayFieldValue value={value} fieldSource={fieldSource} />
			</dd>
		</div>
	);
};
