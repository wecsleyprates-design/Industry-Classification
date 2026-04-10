import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { cn, indexBasedOnMonth } from "@/lib/utils";
import { useRiskAlertStats } from "@/services/queries/dashboard.query";
import { DateSelector } from "./date-selector";
import { EmptyResultsDisplay } from "./empty-states";

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
	creditScore: "#1E40AF", // blue-800
	worthScore: "#2563EB", // blue-600
	judgements: "#60A5FA", // blue-400
	others: "#BFDBFE", // blue-200
};

const chartConfig = {
	creditScore: { label: "Credit Score", color: colors.creditScore },
	worthScore: { label: "Worth Score Change", color: colors.worthScore },
	judgements: {
		label: "Judgements, Liens, Bankruptcies",
		color: colors.judgements,
	},
	others: { label: "Others", color: colors.others },
} satisfies ChartConfig;

const barKeys = ["creditScore", "worthScore", "judgements", "others"];

interface RoundedBarProps {
	x: number;
	y: number;
	width: number;
	height: number;
	fill: string;
	isTop: boolean;
}

// custom bar shape for the chart. It's used to create a rounded top bar for the top reason (highest value gets rounded, others sit flush).
const RoundedBar = (props: RoundedBarProps) => {
	const { fill, x, y, width, height, isTop } = props;
	const radius = isTop ? [8, 8, 0, 0] : [0, 0, 0, 0];

	return (
		<path
			d={`M${x},${y + radius[0]}
       A${radius[0]},${radius[0]} 0 0 1 ${x + radius[0]},${y}
       L${x + width - radius[1]},${y}
       A${radius[1]},${radius[1]} 0 0 1 ${x + width},${y + radius[1]}
       L${x + width},${y + height - radius[2]}
       A${radius[2]},${radius[2]} 0 0 1 ${x + width - radius[2]},${y + height}
       L${x + radius[3]},${y + height}
       A${radius[3]},${radius[3]} 0 0 1 ${x},${y + height - radius[3]}
       Z`}
			fill={fill}
		/>
	);
};

export const ReasonsRiskAlerts = ({ customerId }: { customerId: string }) => {
	const [riskAlertDate, setRiskAlertDate] = useState<Date>(new Date());
	const [isDateUpdated, setIsDateUpdated] = useState<boolean>(false);
	const [yValues, setYValues] = useState<{ min: number; max: number }>({
		min: 0,
		max: 100,
	});

	const [params, setParams] = useState<any>({
		filter: {
			"data_risk_alerts_config.risk_level": ["MODERATE", "HIGH"],
		},
	});

	const { data: riskAlertsStats } = useRiskAlertStats({
		customerId,
		params,
	});

	useEffect(() => {
		setParams((prev: any) => ({
			...prev,
			...(isDateUpdated && {
				period: isDateUpdated
					? dayjs(riskAlertDate).utc().get("year").toString()
					: undefined,
			}),
		}));
	}, [isDateUpdated, riskAlertDate]);

	const chartData = useMemo(() => {
		if (!riskAlertsStats?.data?.result?.length) {
			return [];
		}
		const quarterlyData = [
			{
				quarter: "Q1",
				creditScore: 0,
				worthScore: 0,
				judgements: 0,
				others: 0,
				total: 0,
			},
			{
				quarter: "Q2",
				creditScore: 0,
				worthScore: 0,
				judgements: 0,
				others: 0,
				total: 0,
			},
			{
				quarter: "Q3",
				creditScore: 0,
				worthScore: 0,
				judgements: 0,
				others: 0,
				total: 0,
			},
			{
				quarter: "Q4",
				creditScore: 0,
				worthScore: 0,
				judgements: 0,
				others: 0,
				total: 0,
			},
		];

		riskAlertsStats.data.result.forEach((item) => {
			const month = item.month;

			const monthIndex = indexBasedOnMonth(month);
			if (monthIndex !== undefined) {
				const quarterIndex = Math.floor(monthIndex / 3);

				quarterlyData[quarterIndex].creditScore +=
					Number(item.credit_score) || 0;
				quarterlyData[quarterIndex].worthScore += Number(item.worth_score) || 0;
				quarterlyData[quarterIndex].judgements +=
					Number(item.judgements_liens) || 0;
				quarterlyData[quarterIndex].others += Number(item.others) || 0;
			}
		});

		let maxValue = 0;
		quarterlyData.forEach((quarter) => {
			quarter.total =
				quarter.creditScore +
				quarter.worthScore +
				quarter.judgements +
				quarter.others;
			maxValue = Math.max(maxValue, quarter.total);

			let topKey = "";
			for (let i = barKeys.length - 1; i >= 0; i--) {
				if (Number(quarter[barKeys[i] as keyof typeof quarter]) > 0) {
					topKey = barKeys[i];
					break;
				}
			}
			(quarter as any).topKey = topKey;
		});

		setYValues({ min: 0, max: maxValue });

		return quarterlyData;
	}, [riskAlertsStats]);

	const isEmpty =
		chartData.length === 0 || chartData.every((q) => q.total === 0);

	return (
		<Card className="flex flex-col">
			<CardHeader className="flex flex-row items-start justify-between">
				<div>
					<CardTitle className="text-[16px] font-semibold">
						Risk Alerts
					</CardTitle>
					<p className="text-[14px] text-muted-foreground">Top Reasons</p>
				</div>

				<DateSelector
					type={"year"}
					date={riskAlertDate}
					updateDate={(date) => {
						setRiskAlertDate(dayjs(date).add(1, "month").toDate());
						setIsDateUpdated(true);
					}}
					width="80px"
				/>
			</CardHeader>
			<CardContent className="pl-0 mt-4">
				<div className="relative">
					<ChartContainer
						config={chartConfig}
						className={cn("h-[300px] w-full", isEmpty && "pointer-events-none")}
					>
						<BarChart
							data={
								isEmpty
									? [
											{ quarter: "Q1" },
											{ quarter: "Q2" },
											{ quarter: "Q3" },
											{ quarter: "Q4" },
										]
									: chartData
							}
						>
							{!isEmpty && <CartesianGrid vertical={false} stroke="#E5E7EB" />}
							<XAxis dataKey="quarter" tickLine={false} axisLine={false} />
							<YAxis
								domain={[0, isEmpty ? 100 : yValues.max * 1.1]}
								ticks={
									isEmpty
										? [0, 20, 40, 60, 80, 100]
										: Array.from({ length: 6 }, (_, i) =>
												Math.round((i * (yValues.max * 1.1)) / 5),
											)
								}
								tickLine={false}
								axisLine={false}
							/>
							{!isEmpty && <ChartTooltip content={<ChartTooltipContent />} />}
							{!isEmpty && (
								<>
									{barKeys.map((key) => (
										<Bar
											key={key}
											dataKey={key}
											stackId="stack"
											fill={chartConfig[key as keyof typeof chartConfig].color}
											shape={(props: any) => (
												<RoundedBar
													{...props}
													isTop={props.payload.topKey === key}
												/>
											)}
										/>
									))}
								</>
							)}
						</BarChart>
					</ChartContainer>
					{isEmpty && (
						<div className="absolute inset-0 flex items-center justify-center ml-8">
							<EmptyResultsDisplay />
						</div>
					)}
				</div>
			</CardContent>
			<CardFooter className="flex flex-col items-start gap-2 mt-6">
				{barKeys.map((key) => {
					const config = chartConfig[key as keyof typeof chartConfig];
					return (
						<div key={config.label} className="flex items-center gap-2">
							<div
								className="w-3 h-3 rounded-full"
								style={{ backgroundColor: config.color }}
							/>
							<span className="text-xs text-muted-foreground">
								{config.label}
							</span>
						</div>
					);
				})}
			</CardFooter>
		</Card>
	);
};
