import { useMemo, useState } from "react";
import dayjs from "dayjs";
import {
	Bar,
	CartesianGrid,
	ComposedChart,
	Line,
	XAxis,
	YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import { useGetCustomerPortfolio } from "@/services/queries/dashboard.query";
import { DateSelector } from "./date-selector";
import { EmptyResultsDisplay } from "./empty-states";
import { Skeleton } from "./skeleton";

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
	businesses: "#2563EB", // blue-600
	score: "#172554", // blue-950
};

const chartConfig = {
	businesses: { label: "Total Business Count", color: colors.businesses },
	score: { label: "Average Score", color: colors.score },
} satisfies ChartConfig;

const months = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
];
const PortfolioLevelScoreNullState = () => {
	return (
		<Card className="w-full h-full">
			<CardHeader className="flex flex-row items-center justify-between pb-4">
				<Skeleton className="h-6 w-44" />
				<Skeleton className="w-20 h-6" />
			</CardHeader>
			<CardContent className="flex items-center justify-center h-[400px]">
				<Skeleton className="w-full h-full" />
			</CardContent>
			<CardFooter className="flex items-center justify-center gap-x-2">
				<Skeleton className="w-6 h-6 rounded-full" />
				<Skeleton className="w-40 h-6" />
				<Skeleton className="w-6 h-6 rounded-full" />
				<Skeleton className="w-40 h-6" />
			</CardFooter>
		</Card>
	);
};
export const PortfolioLevelScore: React.FC<{
	customerId: string;
}> = ({ customerId }) => {
	const [selectedYear, setSelectedYear] = useState(new Date());
	const [isDateUpdated, setIsDateUpdated] = useState(false);
	const { data, isLoading } = useGetCustomerPortfolio({
		customerId,
		period: isDateUpdated ? selectedYear : undefined,
	});

	const chartData = months.map((month) => {
		const monthData = data?.data?.monthly_data?.find((d) =>
			d.month.toLowerCase().startsWith(month.toLowerCase()),
		);
		return {
			month,
			businesses: monthData?.total_businesses_count ?? 0,
			score: Math.round(Number(monthData?.average_score) || 0),
		};
	});
	const isEmpty = useMemo(
		() => chartData.every((d) => d.businesses === 0 && d.score === 0),
		[chartData],
	);

	// ticks calculation
	const scores = chartData.map((d) => Number(d.score));
	const businesses = chartData.map((d) => Number(d.businesses));
	const maxBusinessCount = Math.max(...businesses);
	const businessTicks = Array.from({ length: 6 }, (_, i) =>
		Math.round((i * maxBusinessCount * 1.1) / 5),
	);

	const maxScore = Math.max(...scores);
	const scoreTicks = Array.from({ length: 6 }, (_, i) =>
		Math.round((i * maxScore * 1.1) / 5),
	);

	return isLoading ? (
		<PortfolioLevelScoreNullState />
	) : (
		<Card className="flex flex-col">
			<CardHeader className="flex flex-row items-center justify-between pb-4">
				<CardTitle className="text-[16px] font-semibold">
					Portfolio Level Score Over Time
				</CardTitle>

				<DateSelector
					type={"year"}
					date={selectedYear}
					updateDate={(date) => {
						/*
						added 1 month in order this to work across multiple timezones we have done this,
						since date selector return 1st day of year based on current timezone 
						*/
						setSelectedYear(dayjs(date).add(1, "month").toDate());
						setIsDateUpdated(true);
					}}
					width="80px"
				/>
			</CardHeader>
			<CardContent className="relative flex-1">
				<ChartContainer
					config={chartConfig}
					className={cn("h-[400px] w-full", isEmpty && "pointer-events-none")}
				>
					<ComposedChart data={chartData}>
						{!isEmpty && <CartesianGrid vertical={false} stroke="#E5E7EB" />}
						<XAxis
							dataKey="month"
							axisLine={true}
							stroke="#E5E7EB"
							tickLine={false}
							tick={{ fill: "#6B7280", fontSize: 14 }}
						/>
						<YAxis
							yAxisId="left"
							orientation="left"
							domain={
								businesses.every((item) => item === 0)
									? [0, 1000]
									: [0, maxBusinessCount * 1.1]
							}
							ticks={
								businesses.every((item) => item === 0)
									? [0, 200, 400, 600, 800, 1000]
									: businessTicks
							}
							allowDecimals={false}
							axisLine={false}
							tickLine={false}
							tick={{ fill: colors.businesses, fontSize: 14 }}
						/>
						<YAxis
							yAxisId="right"
							orientation="right"
							domain={
								scores.every((item) => item === 0)
									? [0, 850]
									: [0, maxScore * 1.1]
							}
							ticks={
								scores.every((item) => item === 0)
									? [0, 170, 340, 510, 680, 850]
									: scoreTicks
							}
							axisLine={false}
							tickLine={false}
							tick={{ fill: colors.score, fontSize: 14 }}
						/>
						<ChartTooltip content={<ChartTooltipContent />} />
						{!isEmpty && (
							<>
								<Bar
									yAxisId="left"
									dataKey="businesses"
									fill={colors.businesses}
									radius={[8, 8, 8, 8]}
									barSize={40}
								/>
								<Line
									yAxisId="right"
									type="monotone"
									dataKey="score"
									stroke={colors.score}
									strokeWidth={2}
									dot={{ fill: colors.score, r: 4 }}
								/>
							</>
						)}
					</ComposedChart>
				</ChartContainer>
				{isEmpty && (
					<div className="absolute inset-0 flex items-center justify-center">
						<EmptyResultsDisplay />
					</div>
				)}
			</CardContent>
			<CardFooter className="flex justify-center gap-8 pt-4">
				<div className="flex items-center gap-2">
					<div
						className="w-3 h-3 rounded-sm"
						style={{ backgroundColor: colors.businesses }}
					/>
					<span className="text-xs text-muted-foreground">
						Total Business Count
					</span>
				</div>
				<div className="flex items-center gap-2">
					<div
						className="w-3 h-3 rounded-sm"
						style={{ backgroundColor: colors.score }}
					/>
					<span className="text-xs text-muted-foreground">Average Score</span>
				</div>
			</CardFooter>
		</Card>
	);
};
