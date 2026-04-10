import { useMemo } from "react";
import { useNavigate } from "react-router";
import { useFlags } from "launchdarkly-react-client-sdk";
import queryString from "query-string";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { type CaseInProgressData } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useGetCaseInProgress } from "@/services/queries/dashboard.query";
import { URL } from "../constants";
import { EmptyResultsDisplay } from "./empty-states";

import { CASE_STATUS } from "@/constants/case-status";
import FEATURE_FLAGS from "@/constants/FeatureFlags";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@/ui/chart";

const colors: Record<string, string> = {
	received: "#2563EB", // blue-600
	created: "#2563EB", // blue-600
	review: "#3B82F6", // blue-500
	invited: "#3B82F6", // blue-500
	complete: "#60A5FA", // blue-400
	onboarding: "#60A5FA", // blue-400
	abandoned: "#93C5FD", // blue-300
	submitted: "#93C5FD", // blue-300
};

const getBarData = (
	chartData: CaseInProgressData | undefined,
	shouldPauseDecisioning: boolean,
) => {
	if (chartData?.decisions)
		if (shouldPauseDecisioning) {
			return [
				{
					name: `Created (${chartData.decisions?.CREATED?.count})`,
					count: chartData.decisions?.CREATED?.count,
					fill: colors.created,
				},
				{
					name: `Invited (${chartData.decisions?.INVITED?.count})`,
					count: chartData.decisions?.INVITED?.count,
					fill: colors.invited,
				},
				{
					name: `Onboarding (${chartData.decisions?.ONBOARDING?.count})`,
					count: chartData.decisions?.ONBOARDING?.count,
					fill: colors.onboarding,
				},
				{
					name: `Submitted (${chartData.decisions?.SUBMITTED?.count || 0})`,
					count: chartData.decisions?.SUBMITTED?.count || 0,
					fill: colors.submitted,
				},
			];
		} else {
			return [
				{
					name: `Received (${chartData.decisions?.ONBOARDING?.count})`,
					count: chartData.decisions?.ONBOARDING?.count,
					fill: colors.received,
				},
				{
					name: `Under Review (${chartData.decisions?.UNDER_MANUAL_REVIEW?.count})`,
					count: chartData.decisions?.UNDER_MANUAL_REVIEW?.count,
					fill: colors.review,
				},
				{
					name: `Complete (${chartData.decisions?.PENDING_DECISION?.count})`,
					count: chartData.decisions?.PENDING_DECISION?.count,
					fill: colors.complete,
				},
				{
					name: `Abandoned (${chartData.decisions?.ABANDONED?.count || 0})`,
					count: chartData.decisions?.ABANDONED?.count || 0,
					fill: colors.abandoned,
				},
			];
		}
	return [
		{ name: "Received", count: 0, fill: colors.received },
		{ name: "Under Review", count: 0, fill: colors.review },
		{ name: "Complete", count: 0, fill: colors.complete },
		{ name: "Abandoned", count: 0, fill: colors.abandoned },
	];
};

export const CasesInProgress: React.FC<{
	customerId: string;
}> = ({ customerId }) => {
	const navigate = useNavigate();
	const { data, isLoading } = useGetCaseInProgress(customerId);
	const chartData = data?.data;

	const handleBarClick = (data: {
		name?: string;
		count?: number;
		fill?: string;
	}) => {
		if (data?.name) {
			// Extract the title without the count
			const title = data.name.split("(")[0].trim();

			// Add your custom logic here based on the title
			let searchQuery = "";
			switch (title) {
				case "Created":
					searchQuery = queryString.stringify({
						filter: `data_cases.status[0]=${CASE_STATUS.CREATED}`,
					});
					break;
				case "Invited":
					searchQuery = queryString.stringify({
						filter: `data_cases.status[0]=${CASE_STATUS.INVITED}`,
					});
					break;
				case "Submitted":
					searchQuery = queryString.stringify({
						filter: `data_cases.status[0]=${CASE_STATUS.SUBMITTED}`,
					});
					break;
				case "Complete":
					searchQuery = queryString.stringify({
						filter: `data_cases.status[0]=${CASE_STATUS.PENDING_DECISION}`,
					});
					break;
				case "Under Review":
					searchQuery = queryString.stringify({
						filter: `data_cases.status[0]=${CASE_STATUS.UNDER_MANUAL_REVIEW}`,
					});
					break;
				case "Received":
				case "Onboarding":
					searchQuery = queryString.stringify({
						filter: `data_cases.status[0]=${CASE_STATUS.ONBOARDING}`,
					});
					break;
				default:
					break;
			}

			navigate({
				pathname: URL.CASE,
				search: searchQuery,
			});
		}
	};

	const flags = useFlags();

	const barData = getBarData(
		chartData,
		flags[FEATURE_FLAGS.PAT_926_PAUSE_DECISIONING] as boolean,
	);

	const chartConfig = {
		count: { label: "Count" },
		received: { label: "Received", color: colors.received },
		review: { label: "Under Review", color: colors.review },
		complete: { label: "Complete", color: colors.complete },
		abandoned: { label: "Abandoned", color: colors.abandoned },
	} satisfies ChartConfig;

	const isEmptyState = useMemo(
		() => barData.every((item) => item.count === 0),
		[barData],
	);

	return (
		<Card className="flex flex-col">
			<CardHeader>
				<CardTitle className="text-[16px] font-semibold">
					Applications in Progress
				</CardTitle>
			</CardHeader>
			{!isLoading ? (
				<>
					<CardContent className="relative flex flex-1 items-center justify-center">
						<ChartContainer
							config={chartConfig}
							className={cn("w-full", isEmptyState && "pointer-events-none")}
						>
							<BarChart
								data={barData}
								layout="vertical"
								margin={{ top: 0, right: 10, bottom: 10, left: 10 }}
								barSize={50}
							>
								{!isEmptyState && <CartesianGrid horizontal={false} />}
								<XAxis type="number" hide />
								<YAxis
									type="category"
									dataKey="name"
									tick={{
										fill: "white",
										fontSize: 16,
									}}
									axisLine={false}
									tickLine={false}
									hide
								/>
								<ChartTooltip content={<ChartTooltipContent />} />
								<Bar
									dataKey="count"
									fill="blue-300"
									radius={[8, 8, 8, 8]}
									minPointSize={2}
									label={
										!isEmptyState && {
											position: "right",
											fill: "#6B7280",
											fontSize: 12,
										}
									}
									onClick={handleBarClick}
									cursor="pointer"
								/>
							</BarChart>
						</ChartContainer>
						{isEmptyState && (
							<div className="pointer-events-none absolute inset-0 flex items-center justify-center">
								<EmptyResultsDisplay />
							</div>
						)}
					</CardContent>
					{!isEmptyState ? (
						<CardFooter className="flex content-center justify-center w-full grid-cols-2 text-center">
							<div className="grid grid-cols-2 gap-x-2">
								{barData.map((data) => {
									return (
										<div
											key={data.name}
											className="flex items-center gap-3 my-1"
										>
											<div
												className="w-3 h-3 rounded-full"
												style={{ backgroundColor: data.fill }}
											/>
											<span className="text-xs capitalize text-muted-foreground">
												{data?.name?.split("(")?.[0] ?? "-"}
											</span>
										</div>
									);
								})}
							</div>
						</CardFooter>
					) : null}{" "}
				</>
			) : (
				<></>
			)}
		</Card>
	);
};
