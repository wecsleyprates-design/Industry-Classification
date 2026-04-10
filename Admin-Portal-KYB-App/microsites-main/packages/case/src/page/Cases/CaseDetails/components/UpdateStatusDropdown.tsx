import React, { useMemo } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";
import { usePermission } from "@/hooks/usePermission";
import type { CaseStatus } from "@/types/case";
import { StatusDisplay } from "./StatusDisplay";

import {
	type CASE_STATUS_ENUM,
	ONBOARDING_STATUS_TRANSITIONS,
	RISK_STATUS_TRANSITIONS,
	UPDATABLE_ONBOARDING_STATUSES,
	UPDATABLE_RISK_STATUSES,
} from "@/constants/case-status";
import { Button } from "@/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/ui/dropdown-menu";

export interface UpdateStatusDropdownProps {
	status?: CaseStatus;
	statusOptions: CaseStatus[];
	onSelect: (status: string) => void;
}

export const UpdateStatusDropdown: React.FC<UpdateStatusDropdownProps> = ({
	status,
	statusOptions,
	onSelect,
}) => {
	const [open, setOpen] = React.useState(false);

	const hasCaseStatusWriteAccess = usePermission("case:write:status");

	/* 
	Transition options are the same for all updatable onboarding and risk statuses.
	However, we want to allow the current status to be selected to enable updating the assigned user without changing the status.
	This can be revisited once we support updating the assigned user independently of the status
	and we can remove the current status from the list of allowed options.
	*/
	const allowedOptionsForStatus = useMemo(() => {
		const currentStatus = status?.code as CASE_STATUS_ENUM;

		const isOnboardingStatus =
			UPDATABLE_ONBOARDING_STATUSES.includes(currentStatus);
		const isRiskStatus = UPDATABLE_RISK_STATUSES.includes(currentStatus);

		if (isOnboardingStatus) {
			return ONBOARDING_STATUS_TRANSITIONS.includes(currentStatus)
				? ONBOARDING_STATUS_TRANSITIONS
				: [currentStatus, ...ONBOARDING_STATUS_TRANSITIONS];
		}

		if (isRiskStatus) {
			return RISK_STATUS_TRANSITIONS.includes(currentStatus)
				? RISK_STATUS_TRANSITIONS
				: [currentStatus, ...RISK_STATUS_TRANSITIONS];
		}

		return [];
	}, [status?.code]);

	// Validates the status options based on the statusOptions passed in from the API response
	// and sorts them to put the current status at the top of the list
	const validStatusOptions = useMemo(() => {
		const filteredOptions = statusOptions.filter((option) =>
			allowedOptionsForStatus.includes(option.code as CASE_STATUS_ENUM),
		);

		return filteredOptions.sort((a, b) => {
			if (a.code === status?.code) return -1;
			if (b.code === status?.code) return 1;
			return 0;
		});
	}, [statusOptions, allowedOptionsForStatus, status?.code]);

	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger asChild disabled={!hasCaseStatusWriteAccess}>
				<div
					className={`flex flex-row items-center justify-between w-[450px] gap-2 border border-gray-200 rounded-lg px-2 h-11 text-sm ${
						!hasCaseStatusWriteAccess
							? "cursor-not-allowed opacity-50"
							: ""
					}`}
				>
					<StatusDisplay statusCode={status?.code} />
					<Button
						variant="ghost"
						size="icon"
						className="text-gray-800 hover:bg-transparent p-0 -mr-2"
						disabled={!hasCaseStatusWriteAccess}
					>
						{open ? (
							<ChevronUpIcon className="size-4" />
						) : (
							<ChevronDownIcon className="size-4" />
						)}
					</Button>
				</div>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				className="p-0 w-[450px] z-[101]"
				sideOffset={10}
				side="bottom"
				align="end"
			>
				<div className="space-y-1">
					{validStatusOptions.map((status) => (
						<DropdownMenuItem
							key={status.id}
							onClick={() => {
								onSelect(status.code);
							}}
							className="flex w-full items-center gap-2 hover:cursor-pointer p-2"
						>
							<StatusDisplay statusCode={status.code} />
						</DropdownMenuItem>
					))}
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};
