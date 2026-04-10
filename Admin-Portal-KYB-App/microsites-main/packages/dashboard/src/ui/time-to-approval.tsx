import { useMemo } from "react";
import dayjs from "dayjs";
import {
	Bar,
	BarChart,
	CartesianGrid,
	LabelList,
	Rectangle,
	XAxis,
	YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import { useGetTimeToApproval } from "@/services/queries/dashboard.query";
import { type TimeFilterPeriod } from "./cro";

import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip } from "@/ui/chart";
import { EmptyResultsDisplay } from "@/ui/empty-states";

interface TimeToApprovalProps {
	customerId: string;
	period: TimeFilterPeriod;
	industries?: string[];
	assignees?: string[];
	className?: string;
}

const colors: Record<string, string> = {
	current: "#2563EB", // blue-600
	previous: "#93C5FD", // blue-300
};

const chartConfig = {
	count: { label: "Count" },
	current: { label: "Current Period", color: colors.current },
	previous: { label: "Previous Period", color: colors.previous },
} satisfies ChartConfig;

const EmptyState = () => {
	return (
		<div className="relative w-full h-full">
			<Card className="absolute flex items-center justify-center w-full h-full text-center">
				<CardContent className="flex flex-col items-center gap-2">
					<EmptyResultsDisplay />
				</CardContent>
			</Card>
			<ChartContainer config={chartConfig} className="w-full h-full">
				<BarChart data={[]} layout="vertical" barSize={50}>
					<CartesianGrid
						horizontal={false}
						verticalPoints={[0]}
						stroke="#E5E7EB"
					/>
				</BarChart>
			</ChartContainer>
		</div>
	);
};

// Dynamically sets the radius of the bars based on if both bars are present or not
const BarShape = (props: any) => {
	const { x, y, width, height, fill, payload, dataKey } = props;

	let calculatedRadius: [number, number, number, number];

	if (dataKey === "current") {
		calculatedRadius = payload.previous === 0 ? [8, 8, 8, 8] : [8, 0, 0, 8];
	} else if (dataKey === "previous") {
		calculatedRadius = payload.current === 0 ? [8, 8, 8, 8] : [0, 8, 8, 0];
	} else {
		calculatedRadius = [0, 0, 0, 0];
	}

	return (
		<Rectangle
			x={x}
			y={y}
			width={width}
			height={height}
			fill={fill}
			radius={calculatedRadius}
		/>
	);
};

export function TimeToApproval({
	customerId,
	period,
	className,
	industries,
	assignees,
}: TimeToApprovalProps) {
	const { data, isLoading } = useGetTimeToApproval(customerId, {
		period,
		industries,
		assignees: assignees?.filter((assignee) => assignee !== "unassigned"),
	});

	const timeToApprovalData = data?.data.data;
	const chartData = timeToApprovalData?.map((item) => ({
		bucket: item.label,
		current: item.current.count,
		previous: item.previous.count,
		currentStartDate: item.current.period,
		previousStartDate: item.previous.period,
	}));

	const timeFilterLabel = {
		DAY: "24 hours",
		WEEK: "7 days",
		MONTH: "30 days",
		YEAR: "1 year",
	}[period];

	const CustomTooltip = ({ active, payload }: any) => {
		if (active && payload && payload.length) {
			const data = payload[0].payload;
			const currentDate = dayjs(data.currentStartDate).format("MM/DD/YY");
			const previousDate = dayjs(data.previousStartDate).format("MM/DD/YY");

			return (
				<div className={cn("rounded-lg border bg-background p-4 shadow-sm")}>
					<div className="space-y-2">
						<p className="text-sm text-muted-foreground">{data.bucket}</p>
						<div className="flex items-center gap-2">
							<div className="h-3 w-3 rounded-full bg-[#2563EB]" />
							<span className="text-sm">{currentDate}</span>
							<span className="font-bold">{data.current}</span>
						</div>
						<div className="flex items-center gap-2">
							<div className="h-3 w-3 rounded-full bg-[#93C5FD]" />
							<span className="text-sm">{previousDate}</span>
							<span className="font-bold">{data.previous}</span>
						</div>
					</div>
				</div>
			);
		}
		return null;
	};

	const isEmptyState = useMemo(
		() =>
			chartData?.every(
				(bucket) => bucket.current === 0 && bucket.previous === 0,
			),
		[chartData],
	);

	return (
		<Card className={cn("h-full", "flex-1 flex-col", className)}>
			<CardHeader>
				<CardTitle>Time to Approval</CardTitle>
				<p className="text-sm text-gray-500">vs. {timeFilterLabel} ago</p>
			</CardHeader>
			<CardContent className="pb-4">
				<div className="h-[300px]">
					{isEmptyState && !isLoading ? (
						<EmptyState />
					) : (
						<ChartContainer config={chartConfig} className="w-full h-full">
							<BarChart data={chartData} layout="vertical" barSize={50}>
								<CartesianGrid horizontal={false} />

								<XAxis type="number" hide />
								<YAxis type="category" dataKey="bucket" hide />
								<ChartTooltip
									content={<CustomTooltip />}
									cursor={{ fill: "transparent" }}
								/>
								<Bar
									dataKey="current"
									stackId="stack"
									fill={colors.current}
									shape={BarShape}
								>
									<LabelList
										dataKey="bucket"
										position="insideLeft"
										offset={8}
										fontSize={12}
										fill="white"
										content={(data) => {
											const x = data.x as number;
											const y = data.y as number;
											const height = data.height as number;
											const value = data.value as string;
											const offset = data.offset as number;
											const numberValue = chartData?.find(
												(item) => item.bucket === value,
											)?.current;

											if (numberValue === undefined) return null;

											return (
												<text
													x={+x + offset}
													y={+y + (offset + +height) / 2}
													height={20}
													fill={numberValue < 1 ? "black" : "white"}
													fontWeight="normal"
												>
													{value}
												</text>
											);
										}}
									/>
								</Bar>
								<Bar
									dataKey="previous"
									stackId="stack"
									fill={colors.previous}
									shape={BarShape}
								/>
							</BarChart>
						</ChartContainer>
					)}
				</div>
				<div className="flex items-center justify-center pt-4 space-x-8">
					<div className="flex items-center space-x-2">
						<div
							className="w-3 h-3 rounded-full"
							style={{ backgroundColor: colors.current }}
						/>
						<span className="text-sm text-muted-foreground">
							Current Period
						</span>
					</div>
					<div className="flex items-center space-x-2">
						<div
							className="w-3 h-3 rounded-full"
							style={{ backgroundColor: colors.previous }}
						/>
						<span className="text-sm text-muted-foreground">
							Previous Period
						</span>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
