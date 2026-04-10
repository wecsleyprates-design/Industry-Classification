/**
 * Renders case tab values (decisioning/onboarding results) in three sections: Failed, Passed, Missing.
 * Includes the three GIACT rows (Account Status, Account Name, Contact Verification): label + tooltip only.
 */

import React from "react";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { TitleLeftDivider } from "@/components/Dividers";
import { ReactCustomTooltip } from "@/components/Tooltip";
import type { CaseTabValuesResponse } from "@/types/caseTabValues";

import {
	CASE_TAB_VALUES_ROW_IDS,
	CASE_TAB_VALUES_ROW_LABELS,
	type CaseTabValuesRowId,
	deriveRowStatus,
} from "@/constants/caseTabValues";

interface CaseTabValuesResultsProps {
	/** Response from GET .../business/:businessId/case/:caseId/values */
	data: CaseTabValuesResponse | undefined;
	isLoading?: boolean;
	/** Called when a row is clicked (e.g. to navigate to tab). */
	onRowClick?: (rowId: CaseTabValuesRowId) => void;
}

type StatusKey = "failed" | "passed" | "missing";

const SECTION_ORDER: StatusKey[] = ["failed", "passed", "missing"];
const SECTION_TITLES: Record<StatusKey, string> = {
	failed: "Failed",
	passed: "Passed",
	missing: "Missing",
};

export const CaseTabValuesResults: React.FC<CaseTabValuesResultsProps> = ({
	data,
	isLoading,
	onRowClick,
}) => {
	const values = data?.values ?? {};
	const rowsByStatus = React.useMemo(() => {
		const map: Record<StatusKey, CaseTabValuesRowId[]> = {
			failed: [],
			passed: [],
			missing: [],
		};
		for (const rowId of CASE_TAB_VALUES_ROW_IDS) {
			const item = values[rowId];
			const status = item ? deriveRowStatus(rowId, item) : ("missing" as const);
			map[status].push(rowId);
		}
		return map;
	}, [values]);

	if (isLoading) {
		return (
			<div className="p-4 text-sm text-gray-500">Loading case results…</div>
		);
	}

	const hasAny = SECTION_ORDER.some((s) => rowsByStatus[s].length > 0);
	if (!hasAny) {
		return null;
	}

	return (
		<div className="w-full">
			<TitleLeftDivider text="Case results" />
			<div className="mt-2 space-y-4">
				{SECTION_ORDER.map((status) => {
					const rowIds = rowsByStatus[status];
					if (rowIds.length === 0) return null;
					return (
						<div key={status}>
							<p className="mb-1 text-xs font-medium text-gray-500">
								{SECTION_TITLES[status]}
							</p>
							<ul className="space-y-1">
								{rowIds.map((rowId) => {
									const item = values[rowId];
									const label = CASE_TAB_VALUES_ROW_LABELS[rowId];
									const tooltip = item?.description ?? null;
									const isClickable = !!onRowClick;
									return (
										<li
											key={rowId}
											className={`flex items-center gap-1.5 text-sm ${
												isClickable
													? "cursor-pointer text-[#266EF1] hover:underline"
													: "text-slate-800"
											}`}
											onClick={() => isClickable && onRowClick(rowId)}
											onKeyDown={(e) => {
												if (
													isClickable &&
													(e.key === "Enter" || e.key === " ")
												) {
													e.preventDefault();
													onRowClick(rowId);
												}
											}}
											role={isClickable ? "button" : undefined}
											tabIndex={isClickable ? 0 : undefined}
										>
											<span>{label}</span>
											{tooltip && (
												<ReactCustomTooltip
													id={`tooltip-${rowId}`}
													tooltip={<>{tooltip}</>}
													place="top"
												>
													<span className="inline-flex text-gray-400 hover:text-gray-600">
														<InformationCircleIcon className="h-4 w-4" />
													</span>
												</ReactCustomTooltip>
											)}
										</li>
									);
								})}
							</ul>
						</div>
					);
				})}
			</div>
		</div>
	);
};

export default CaseTabValuesResults;
