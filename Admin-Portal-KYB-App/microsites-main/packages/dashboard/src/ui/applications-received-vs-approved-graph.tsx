import { useMemo } from "react";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import {
	CartesianGrid,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip as ChartTooltip,
	XAxis,
	YAxis,
} from "recharts";
import { type ContentType } from "recharts/types/component/Tooltip";
import { cn } from "@/lib/utils";
import { type FilterDate } from "@/services/api/dashboard.service";
import { useGetReceivedApprovedStats } from "@/services/queries/dashboard.query";

import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { EmptyResultsDisplay } from "@/ui/empty-states";
import { Tooltip } from "@/ui/tooltip";

const ChartContent: React.FC<{
	chartData: Array<{
		day: string;
		received: number;
		approved: number;
		receivedTrend: number;
		approvedTrend: number;
	}>;
	formatXAxisTick: (value: string) => string;
	isEmptyState: boolean;
	isLoading: boolean;
}> = ({ chartData, formatXAxisTick, isEmptyState, isLoading }) => {
	if (isEmptyState && !isLoading) {
		return (
			<>
				<Card className="absolute flex items-center justify-center w-full h-full text-center">
					<CardContent className="flex flex-col items-center gap-2">
						<EmptyResultsDisplay />
					</CardContent>
				</Card>
				<ResponsiveContainer width="100%" height="100%">
					<LineChart
						data={chartData}
						margin={{
							top: 5,
							right: 10,
							left: 10,
							bottom: 0,
						}}
					>
						<XAxis
							dataKey="day"
							stroke="#888888"
							fontSize={12}
							tickLine={false}
							axisLine={{ stroke: "#E5E7EB" }}
							tickFormatter={formatXAxisTick}
						/>
						<YAxis
							stroke="#888888"
							fontSize={12}
							ticks={[0, 10, 20, 30, 40, 50, 60]}
							tickLine={false}
							axisLine={false}
							tickFormatter={(value) => `${value}`}
						/>
					</LineChart>
				</ResponsiveContainer>
			</>
		);
	}

	if (isLoading) {
		return null;
	}

	return (
		<ResponsiveContainer width="100%" height="100%">
			<LineChart
				data={chartData}
				margin={{
					top: 5,
					right: 10,
					left: 10,
					bottom: 0,
				}}
			>
				<CartesianGrid stroke="#E5E7EB" vertical={false} />
				<XAxis
					dataKey="day"
					stroke="#888888"
					fontSize={12}
					tickLine={false}
					axisLine={false}
					tickFormatter={formatXAxisTick}
				/>
				<YAxis
					stroke="#888888"
					fontSize={12}
					tickLine={false}
					axisLine={false}
					tickFormatter={(value) => `${value}`}
				/>
				<ChartTooltip content={CustomTooltip} />
				<Line
					type="linear"
					dataKey="received"
					stroke="#2563EB"
					strokeWidth={4}
					name="Application Received"
					dot={false}
				/>
				<Line
					type="linear"
					dataKey="approved"
					stroke="#2563EB"
					strokeWidth={4}
					strokeDasharray="5 5"
					name="Applications Approved"
					dot={false}
				/>
			</LineChart>
		</ResponsiveContainer>
	);
};

const CustomTooltip: ContentType<any, any> = ({ active, payload }) => {
	if (active && payload && payload.length) {
		const receivedData = payload[0];
		const approvedData = payload[1];

		return (
			<div className="p-4 border rounded-lg shadow-sm bg-background">
				<div className="space-y-3">
					<div className="flex flex-col">
						<span className="mb-1 text-sm text-muted-foreground">
							Applications Received
						</span>
						<div className="flex items-center gap-2">
							<span className="text-2xl font-bold">{receivedData.value}</span>
							<div
								className={cn(
									"text-sm px-1 rounded",
									receivedData.payload.receivedTrend > 0
										? "text-green-600 bg-green-50"
										: "text-red-600 bg-red-50",
								)}
							>
								{receivedData.payload.receivedTrend > 0 ? "+" : ""}
								{receivedData.payload.receivedTrend}%
							</div>
						</div>
					</div>
					<div className="flex flex-col">
						<span className="mb-1 text-sm text-muted-foreground">
							Applications Approved
						</span>
						<div className="flex items-center gap-2">
							<span className="text-2xl font-bold">{approvedData.value}</span>
							<div
								className={cn(
									"text-sm px-1 rounded",
									approvedData.payload.approvedTrend > 0
										? "text-green-600 bg-green-50"
										: "text-red-600 bg-red-50",
								)}
							>
								{approvedData.payload.approvedTrend > 0 ? "+" : ""}
								{approvedData.payload.approvedTrend}%
							</div>
						</div>
					</div>
				</div>
			</div>
		);
	}
	return null;
};

export function ApplicationsReceivedVsApprovedGraph({
	customerId,
	period = "WEEK",
	industries,
	assignees,
}: {
	customerId: string;
	period: "DAY" | "WEEK" | "MONTH" | "YEAR";
	industries?: string[];
	assignees?: string[];
}) {
	// Get user's timezone
	const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

	// Configure filter parameters based on timeFilter
	const getFilterParams = (): FilterDate => {
		switch (period) {
			case "DAY":
				return {
					period: "DAY",
					interval: 9, // 9 intervals for 24 hours
					last: 0,
					timezone: userTimezone,
				};
			case "WEEK":
				return {
					period: "WEEK",
					interval: 7, // 7 days
					last: 0,
					timezone: userTimezone,
				};
			case "MONTH":
				return {
					period: "MONTH",
					interval: 6, // 6 intervals for 30 days
					last: 0,
					timezone: userTimezone,
				};
			case "YEAR":
				return {
					period: "YEAR",
					interval: 12, // 12 months
					last: 0,
					timezone: userTimezone,
				};
			default:
				return {
					period: "WEEK",
					interval: 7,
					last: 0,
					timezone: userTimezone,
				};
		}
	};
	// TODO : This is in progress, need to implement the filter params in the query
	const { data: response, isLoading } = useGetReceivedApprovedStats(
		customerId,
		{
			filterDate: getFilterParams(),
			industries,
			assignees: assignees?.filter((assignee) => assignee !== "unassigned"),
		},
	);

	const transformData = (
		responseData: any,
	): Array<{
		day: string;
		received: number;
		approved: number;
		receivedTrend: number;
		approvedTrend: number;
	}> => {
		if (!responseData?.data) return [];

		const data = responseData.data;

		switch (period) {
			case "DAY": {
				return data.map((item: any) => ({
					day: item.label,
					received: item.received,
					approved: item.approved,
					receivedTrend: item.trends.received,
					approvedTrend: item.trends.approved,
				}));
			}

			case "WEEK": {
				// Weekly data is already in the right format
				return data.map((item: any) => ({
					day: item.label,
					received: item.received,
					approved: item.approved,
					receivedTrend: item.trends.received,
					approvedTrend: item.trends.approved,
				}));
			}

			case "MONTH": {
				// For 30 days, transform the dates into day ranges
				return data.map((item: any, index: number) => {
					const date = new Date(item.label);
					const dayOfMonth = date.getDate();
					const startDay = Math.floor(dayOfMonth / 5) * 5 + 1;
					const endDay = Math.min(startDay + 4, 30);

					return {
						day: `${startDay}-${endDay}`,
						received: item.received,
						approved: item.approved,
						receivedTrend: item.trends.received,
						approvedTrend: item.trends.approved,
					};
				});
			}

			case "YEAR": {
				// Yearly data is already in the right format
				return data.map((item: any) => ({
					day: item.label,
					received: item.received,
					approved: item.approved,
					receivedTrend: item.trends.received,
					approvedTrend: item.trends.approved,
				}));
			}

			default:
				return [];
		}
	};

	const chartData = transformData(response);

	const formatXAxisTick = (value: string) => {
		switch (period) {
			case "DAY": {
				const date = new Date(value);
				return date.toLocaleTimeString("en-US", {
					hour: "numeric",
					hour12: true,
				});
			}
			case "WEEK": {
				return value;
			}
			case "MONTH": {
				return `Days ${value}`;
			}
			case "YEAR": {
				return value;
			}
			default:
				return value;
		}
	};

	const timeFilterLabel = {
		DAY: "24 hours",
		WEEK: "7 days",
		MONTH: "30 days",
		YEAR: "1 year",
	}[period];

	const isEmptyState = useMemo(
		() => chartData.every((item) => item.received === 0 && item.approved === 0),
		[chartData],
	);

	return (
		<Card className="h-full flex-1 flex-col">
			<CardHeader>
				<CardTitle>
					<div className="flex items-center gap-2">
						Applications Received vs. Approved
						<Tooltip
							side="right"
							trigger={<InformationCircleIcon className="w-5 h-5" />}
							className="text-sm text-wrap w-[400px]"
							align="center"
							content={
								<div>
									The percentage values displayed in this chart show overall
									increase or decrease between the current and previous time
									period selected.
								</div>
							}
						/>
					</div>
				</CardTitle>
				<p className="text-sm text-gray-500">vs. {timeFilterLabel} ago</p>
			</CardHeader>
			<CardContent className="pb-4">
				<div className="h-[300px] relative">
					<ChartContent
						chartData={chartData}
						formatXAxisTick={formatXAxisTick}
						isEmptyState={isEmptyState}
						isLoading={isLoading}
					/>
				</div>
				<div className="flex items-center justify-center p-4 space-x-8">
					<div className="flex items-center space-x-2">
						<div className="w-6 h-0 border-t-4 border-solid border-[#2563EB]" />
						<span className="text-sm text-muted-foreground">
							Application Received
						</span>
					</div>
					<div className="flex items-center space-x-2">
						<div className="w-6 h-0 border-t-4 border-dashed border-[#2563EB]" />
						<span className="text-sm text-muted-foreground">
							Applications Approved
						</span>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
