import {
	CartesianGrid,
	Cell,
	ResponsiveContainer,
	Scatter,
	ScatterChart,
	Tooltip,
	XAxis,
	YAxis,
	ZAxis,
} from "recharts";
import { type IndustryExposureDataObject } from "@/lib/types";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./card";
import { EmptyResultsDisplay } from "./empty-states";

interface IndustryData {
	industry: string;
	count: number;
	average_score: string;
	min_score: number | null;
	max_score: number | null;
}

type AxisOption = {
	key: string;
	label: string;
	accessor: (item: IndustryData) => number | null;
};

const getZAxisRange = (counts: number[]) => {
	const max = Math.max(...counts);
	if (max <= 20) return [1500, 9000];
	if (max <= 100) return [1000, 6000];
	if (max <= 1000) return [800, 4000];
	if (max <= 5000) return [400, 2000];
	return [200, 1200];
};
const colors = [
	"#172554", // blue-950
	"#1E3A8A", // blue-900
	"#1E40AF", // blue-800
	"#1D4ED8", // blue-700
	"#2563EB", // blue-600
	"#3B82F6", // blue-500
	"#60A5FA", // blue-400
	"#93C5FD", // blue-300
	"#BFDBFE", // blue-200
	"#DBEAFE", // blue-100
	"#EFF6FF", // blue-50
	"#E5E7EB", // gray-200
];

const IndustryBubbleChart: React.FC<{
	industryData?: IndustryExposureDataObject[];
}> = ({ industryData }) => {
	const axisOptions: AxisOption[] = [
		{
			key: "count",
			label: "Businesses",
			accessor: (item) => item.count,
		},
		{
			key: "average_score",
			label: "Avg. Worth Score for Industry",
			accessor: (item) =>
				item.average_score !== "NaN"
					? Number.parseFloat(item.average_score)
					: null,
		},
		{
			key: "min_score",
			label: "Minimum Score",
			accessor: (item) => item.min_score,
		},
		{
			key: "max_score",
			label: "Maximum Score",
			accessor: (item) => item.max_score,
		},
	];

	const currentXAxisOption =
		axisOptions.find((option) => option.key === "count") ?? axisOptions[0];
	const currentYAxisOption =
		axisOptions.find((option) => option.key === "average_score") ??
		axisOptions[1];

	const chartData = industryData
		?.filter((item) => {
			const xValue = currentXAxisOption.accessor(item);
			const yValue = currentYAxisOption.accessor(item);
			return xValue !== null && yValue !== null;
		})
		.map((item, index) => {
			const xValue = currentXAxisOption.accessor(item);
			const yValue = currentYAxisOption.accessor(item);

			const difference = industryData
				.map((d) =>
					d.max_score && d.min_score && d.max_score - d.min_score !== 0
						? d.max_score - d.min_score
						: 0,
				)
				.filter((item) => item);

			const minCount = Math.min(...difference);
			const maxCount = Math.max(...difference);

			return {
				fill: colors?.[index % colors.length],
				industry: item.industry,
				count: item.count,
				xValue,
				yValue,
				averageScore:
					item.average_score !== "NaN"
						? Number.parseFloat(item.average_score)
						: null,

				size: (() => {
					const difference =
						item.max_score &&
						item.min_score &&
						item.max_score - item.min_score !== 0
							? item.max_score - item.min_score
							: 0;

					if (difference === 0) return 1;
					const safeMin = Math.max(minCount, 1);
					const logMin = Math.log(safeMin);
					const logMax = Math.log(maxCount);
					const logVal = Math.log(difference);

					const normalized = (logVal - logMin) / (logMax - logMin);
					return 10 + normalized * 90;
				})(),
				minScore: item.min_score,
				maxScore: item.max_score,
			};
		});

	const isEmpty = !chartData || chartData.length === 0;

	const xValues = chartData?.map((item) => item.xValue as number) ?? [];
	const yValues = chartData?.map((item) => item.yValue as number) ?? [];

	const xMin = isEmpty ? 0 : Math.min(...xValues);
	const xMax = isEmpty ? 100 : Math.max(...xValues);
	const yMin = isEmpty ? 0 : Math.min(...yValues);
	const yMax = isEmpty ? 850 : Math.max(...yValues);

	const xRange = xMax - xMin;
	const yRange = yMax - yMin;

	const xPadding = xRange * 0.2;
	const yPadding = yRange * 0.2;

	const counts = chartData?.map((item) => item.count) ?? [];
	const zAxisRange = getZAxisRange(counts);

	const CustomTooltip = ({ active, payload }: any) => {
		if (active && payload && payload.length) {
			const data = payload[0].payload;
			return (
				<div className="p-3 text-sm border rounded-md shadow-md bg-background">
					<p className="font-medium">{data.industry}</p>
					<p>Business: {data.count}</p>
					{data.averageScore !== null && (
						<p>Average Worth Score: {Math.round(data.averageScore)}</p>
					)}
				</div>
			);
		}
		return null;
	};

	const calculateTicks = (min: number, max: number, targetCount = 5) => {
		const range = max - min;
		let stepSize = range / targetCount;
		const magnitude = Math.pow(10, Math.floor(Math.log10(stepSize)));
		const normalized = stepSize / magnitude;
		if (normalized < 1.5) stepSize = magnitude;
		else if (normalized < 3) stepSize = 2 * magnitude;
		else if (normalized < 7.5) stepSize = 5 * magnitude;
		else stepSize = 10 * magnitude;
		const firstTick = Math.ceil(min / stepSize) * stepSize;
		const ticks = [];
		for (let tick = firstTick; tick <= max + stepSize * 0.5; tick += stepSize) {
			ticks.push(Number(tick.toFixed(10)));
		}
		return ticks;
	};

	return (
		<>
			<Card className="w-full">
				<CardHeader className="mb-2">
					<CardTitle className="text-[16px] font-semibold">
						Industry Exposure
					</CardTitle>
				</CardHeader>
				<CardContent className="relative flex-1">
					<div className={isEmpty ? "pointer-events-none" : ""}>
						<ResponsiveContainer
							width="100%"
							height="70%"
							minHeight={"350px"}
							className="pt-4"
						>
							<ScatterChart
								margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
							>
								{!isEmpty && (
									<CartesianGrid strokeOpacity={0.4} vertical={false} />
								)}
								<XAxis
									type="number"
									dataKey="xValue"
									name={currentXAxisOption.label}
									label={{
										value: currentXAxisOption.label,
										position: "bottom",
										offset: 10,
										style: {
											fontSize: 14,
											fill: "#334155",
											fontWeight: "normal",
										},
									}}
									axisLine={true}
									tickLine={false}
									stroke="#E5E7EB"
									tick={{ fill: "#6B7280", fontSize: 14 }}
									domain={
										isEmpty ? [10, 100] : [xMin - xPadding, xMax + xPadding]
									}
									ticks={
										isEmpty
											? [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
											: calculateTicks(xMin - xPadding, xMax + xPadding)
									}
									interval={0}
								/>
								<YAxis
									type="number"
									dataKey="yValue"
									name={currentYAxisOption.label}
									axisLine={false}
									tickLine={false}
									tick={{ fill: "#6B7280", fontSize: 14 }}
									label={{
										value: currentYAxisOption.label,
										angle: -90,
										position: "insideLeft",
										offset: 0,
										dy: 0,
										style: {
											fontSize: 14,
											fill: "#334155",
											fontWeight: "normal",
											textAnchor: "middle",
										},
									}}
									domain={
										isEmpty ? [350, 850] : [yMin - yPadding, yMax + yPadding]
									}
									ticks={
										isEmpty
											? [350, 450, 550, 650, 750, 850]
											: calculateTicks(yMin - yPadding, yMax + yPadding)
									}
									interval={0}
								/>
								<ZAxis
									type="number"
									dataKey="size"
									range={
										zAxisRange.length >= 2
											? ([zAxisRange[0], zAxisRange[1]] as [number, number])
											: undefined
									}
									name="Size"
								/>
								<Tooltip content={<CustomTooltip />} cursor={false} />
								{!isEmpty && (
									<Scatter name="Industries" data={chartData}>
										{chartData?.map((entry, index) => (
											<Cell
												key={`cell-${index}`}
												fill={colors[index % colors.length]}
												opacity={0.8}
											/>
										))}
									</Scatter>
								)}
							</ScatterChart>
						</ResponsiveContainer>
					</div>
					{isEmpty && (
						<div className="absolute inset-0 flex items-center justify-center">
							<EmptyResultsDisplay />
						</div>
					)}
				</CardContent>
				<CardFooter className="flex items-center justify-center w-full text-center min-h-40">
					{isEmpty ? (
						<span className="text-sm text-muted-foreground">
							No industry data available for legend.
						</span>
					) : (
						<div className="grid grid-cols-2 gap-x-4">
							{chartData?.map((data) => {
								return (
									<div
										key={data.industry}
										className="flex items-center gap-3 my-1 "
									>
										<div
											className="w-3 h-3 rounded-full"
											style={{ backgroundColor: data.fill }}
										/>
										<span className="text-xs text-muted-foreground capitalize break-words">
											{data.industry ?? "-"}
										</span>
									</div>
								);
							})}
						</div>
					)}
				</CardFooter>
			</Card>
		</>
	);
};
export default IndustryBubbleChart;
