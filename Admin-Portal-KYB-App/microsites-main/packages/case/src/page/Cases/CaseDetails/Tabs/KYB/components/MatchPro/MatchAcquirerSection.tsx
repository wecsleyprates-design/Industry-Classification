import React, { useMemo } from "react";
import {
	ArrowPathIcon,
	CheckIcon,
	ChevronDownIcon,
} from "@heroicons/react/24/outline";
import { Row } from "./MatchRows";
import type { MatchICAUIResult } from "./types";
import { getMatchStatusDefinition, resolveMatchStatus } from "./utils";

import { Badge, VerificationBadge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card, CardContent, CardTitle } from "@/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/ui/dropdown-menu";

interface MatchAcquirerSectionProps {
	result: MatchICAUIResult;
	allIcas: MatchICAUIResult[];
	onResubmit: () => void;
	onSelectIca: (ica: string) => void;
}

export const MatchAcquirerSection: React.FC<MatchAcquirerSectionProps> = ({
	result,
	allIcas,
	onResubmit,
	onSelectIca,
}) => {
	const {
		statusDef,
		StatusIcon,
		icaId,
		acquirerName,
		selectedLabel,
		lastChecked,
	} = useMemo(() => {
		const statusEnum = resolveMatchStatus(result);
		const statusDef = getMatchStatusDefinition(statusEnum);
		const icaId = result.ica === "Error" ? null : result.ica;
		const validIcaName =
			result.icaName && !/^\d+$/.test(result.icaName)
				? result.icaName
				: undefined;
		const acquirerName = validIcaName ?? (icaId ? `ICA ${icaId}` : "N/A");
		const selectedLabel =
			result.matches?.merchantInfo?.name ?? acquirerName;
		const ts = result.timestamp ?? result.matches?.timestamp;
		const lastChecked = ts ? new Date(ts).toLocaleString() : "N/A";
		return {
			statusDef,
			StatusIcon: statusDef.icon,
			icaId,
			acquirerName,
			selectedLabel,
			lastChecked,
		};
	}, [result]);

	return (
		<Card>
			<CardContent className="pt-4 pb-2">
				{/* Title row */}
				<div className="flex items-center justify-between mb-3">
					<CardTitle className="text-base font-semibold">
						MATCH List
					</CardTitle>
					<div className="flex items-center gap-2">
						{icaId ? (
							<Button
								variant="outline"
								size="sm"
								className="gap-1.5 h-10 text-xs"
								onClick={onResubmit}
							>
								<ArrowPathIcon className="w-3.5 h-3.5" />
								Resubmit
							</Button>
						) : null}

						{allIcas.length > 1 ? (
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button
										variant="outline"
										size="sm"
										className="gap-1.5 h-10 text-xs max-w-[180px] truncate"
									>
										<span className="truncate">
											{selectedLabel}
										</span>
										<ChevronDownIcon className="w-3.5 h-3.5 shrink-0" />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end">
									{allIcas.map((ica) => {
										const label =
											ica.matches?.merchantInfo?.name ??
											ica.icaName ??
											`ICA ${ica.ica}`;

										return (
											<DropdownMenuItem
												key={ica.ica}
												onClick={() =>
													onSelectIca(ica.ica)
												}
											>
												<div className="flex items-center gap-2">
													{ica.ica === result.ica ? (
														<CheckIcon className="w-3.5 h-3.5 shrink-0" />
													) : null}
													{label}
												</div>
											</DropdownMenuItem>
										);
									})}
								</DropdownMenuContent>
							</DropdownMenu>
						) : null}
					</div>
				</div>

				{/* Acquirer rows */}
				<dl className="divide-y divide-gray-100 border-t border-gray-100">
					<Row label="Acquirer">
						<span className="text-sm text-gray-900">
							{acquirerName}
						</span>
						<VerificationBadge
							variant={statusDef.variant}
							className="gap-1 ml-2"
						>
							{StatusIcon ? (
								<StatusIcon className="w-3.5 h-3.5" />
							) : null}
							{statusDef.text}
						</VerificationBadge>
					</Row>
					<Row label="Acquirer ID">
						{icaId ? `ICA ${icaId}` : "N/A"}
					</Row>
					<Row label="Last Checked">{lastChecked}</Row>
				</dl>
			</CardContent>
		</Card>
	);
};
