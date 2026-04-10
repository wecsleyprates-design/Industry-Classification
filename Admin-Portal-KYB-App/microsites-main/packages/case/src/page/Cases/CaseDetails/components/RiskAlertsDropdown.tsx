import React, { useMemo } from "react";
import { ExclamationCircleIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";
import { type RiskAlert } from "@/types/case";

import { Button } from "@/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/ui/dropdown-menu";
import { Tooltip } from "@/ui/tooltip";

export interface RiskAlertsDropdownProps {
	riskAlerts: RiskAlert[];
}

export const RiskAlertsDropdown: React.FC<RiskAlertsDropdownProps> = ({
	riskAlerts,
}) => {
	const [open, setOpen] = React.useState(false);

	const hasRiskAlerts = riskAlerts?.length > 0;
	const { highRiskCount, moderateRiskCount } = useMemo(
		() => ({
			highRiskCount: riskAlerts?.filter(
				(item: any) => item.risk_level === "HIGH",
			).length,
			moderateRiskCount: riskAlerts?.filter(
				(item: any) => item.risk_level === "MODERATE",
			).length,
		}),
		[riskAlerts],
	);

	return (
		<DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
			<Tooltip
				content={hasRiskAlerts ? "Risk Alerts" : "No Risk Alerts"}
				side="bottom"
				trigger={
					<DropdownMenuTrigger asChild>
						<Button
							variant="outline"
							className={cn(
								"group text-gray-800 p-2 h-11",
								!hasRiskAlerts &&
									"hover:bg-transparent cursor-not-allowed",
							)}
						>
							<ExclamationCircleIcon
								className={`!size-5 ${
									highRiskCount
										? "text-red-500"
										: moderateRiskCount
											? "text-yellow-500"
											: "text-red-500"
								} `}
							/>
							<div
								className={cn(
									"flex items-center gap-2 rounded-lg bg-gray-100 px-3 text-xs text-gray-500",
									hasRiskAlerts && "group-hover:bg-gray-200",
								)}
							>
								{riskAlerts?.length}
							</div>
						</Button>
					</DropdownMenuTrigger>
				}
			/>

			{hasRiskAlerts && (
				<DropdownMenuContent
					className="p-0 w-[400px] mx-2"
					sideOffset={10}
					side="bottom"
					align="center"
				>
					<div className="space-y-1">
						{riskAlerts.map((riskAlert: RiskAlert) => (
							<DropdownMenuItem
								key={riskAlert.id}
								className="flex items-center w-full gap-2 p-2 focus:bg-transparent"
							>
								<div className="flex items-start w-full gap-4">
									<div
										className={cn(
											"flex-shrink-0 flex items-center justify-center rounded-lg p-2 size-10",
											riskAlert.risk_level === "HIGH"
												? "bg-red-100 text-red-500"
												: "bg-yellow-100 text-yellow-500",
										)}
									>
										<ExclamationCircleIcon className="size-5" />
									</div>

									<div className="flex flex-col">
										<p className="text-sm font-medium leading-tight">
											{riskAlert.title}
										</p>
										<p className="text-xs leading-normal text-gray-500">
											{riskAlert.description}
										</p>
									</div>
								</div>
							</DropdownMenuItem>
						))}
					</div>
				</DropdownMenuContent>
			)}
		</DropdownMenu>
	);
};
