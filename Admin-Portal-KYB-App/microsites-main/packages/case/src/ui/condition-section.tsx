import { type FC, type ReactElement } from "react";
import {
	CheckCircleIcon,
	ExclamationCircleIcon,
	ExclamationTriangleIcon,
} from "@heroicons/react/24/solid";
import { ExpandContent } from "@/components/ExpandContent";

export type ConditionRowStatus = "passed" | "failed" | "missing";

export interface ConditionSectionRow<TRowId extends string = string> {
	rowId: TRowId;
	label: string;
	header?: string | null;
	body?: string | null;
	description?: string;
}

export interface ConditionSectionProps<TRowId extends string = string> {
	title: string;
	description: string;
	count: number;
	rows: ConditionSectionRow<TRowId>[];
	status: ConditionRowStatus;
	onRowClick?: (rowId: TRowId) => void;
	Icon: React.ComponentType<{ className?: string }>;
	iconColor: string;
	bgColor: string;
}

interface ResultRowProps {
	label: string;
	header?: string | null;
	body?: string | null;
	description?: string;
	status: ConditionRowStatus;
	onClick?: () => void;
}

const ResultRow: FC<ResultRowProps> = ({
	label,
	header,
	body,
	description,
	status,
	onClick,
}) => {
	const isFailed = status === "failed";
	const isMissing = status === "missing";
	const Icon = isMissing
		? ExclamationTriangleIcon
		: isFailed
			? ExclamationCircleIcon
			: CheckCircleIcon;
	const iconColor = isMissing
		? "text-amber-500"
		: isFailed
			? "text-red-500"
			: "text-green-600";
	const bgColor = isMissing
		? "bg-amber-100"
		: isFailed
			? "bg-red-100"
			: "bg-green-100";

	const hasSpecHeader = header != null && header !== "";
	const firstLine = hasSpecHeader ? header : label;
	const hasSpecBody = body != null && body !== "";
	const secondLine = hasSpecBody
		? body
		: !hasSpecHeader
			? "Not available."
			: null;

	return (
		<button
			type="button"
			className="flex w-full gap-3 text-left rounded-md hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-200 focus:ring-offset-1"
			onClick={onClick}
		>
			<div
				className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${bgColor}`}
			>
				<Icon className={`w-6 h-6 ${iconColor}`} />
			</div>
			<div className="flex flex-col flex-1 min-w-0">
				<span className="text-sm font-medium text-gray-900">
					{firstLine}
				</span>
				{secondLine != null && (
					<span className="text-sm font-light text-gray-500">
						{secondLine}
					</span>
				)}
			</div>
		</button>
	);
};

export function ConditionSection<TRowId extends string = string>({
	title,
	description,
	count,
	rows,
	status,
	onRowClick,
	Icon,
	iconColor,
	bgColor,
}: ConditionSectionProps<TRowId>): ReactElement | null {
	if (count === 0) return null;
	const sectionTitle = `${count} Condition${count !== 1 ? "s" : ""} ${title}`;
	return (
		<ExpandContent
			initialIsExpanded={true}
			title={
				<div className="flex gap-3 flex-1 min-w-0 items-center rounded-md hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-200 focus:ring-offset-1">
					<div
						className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${bgColor}`}
					>
						<Icon className={`w-6 h-6 ${iconColor}`} />
					</div>
					<div className="flex flex-col flex-1 min-w-0">
						<span className="text-base font-semibold text-gray-900">
							{sectionTitle}
						</span>
						<span className="text-sm font-light text-gray-500">
							{description}
						</span>
					</div>
				</div>
			}
		>
			<div className="flex flex-col gap-2 border-t border-gray-200 pt-4">
				{rows.map(
					({
						rowId,
						label,
						header,
						body,
						description: rowDescription,
					}) => (
						<ResultRow
							key={rowId}
							label={label}
							header={header}
							body={body}
							description={rowDescription}
							status={status}
							onClick={
								onRowClick ? () => onRowClick(rowId) : undefined
							}
						/>
					),
				)}
			</div>
		</ExpandContent>
	);
}
