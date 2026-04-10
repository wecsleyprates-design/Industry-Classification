import { memo, useEffect, useState } from "react";
import { Bar } from "react-chartjs-2";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import {
	BarElement,
	CategoryScale,
	Chart as ChartJS,
	LinearScale,
	Title,
	Tooltip,
} from "chart.js";
import { capitalize } from "@/lib/helper";
import { type WorthScoreData } from "@/types/worthScore";
import FullPageLoader from "../Spinner/FullPageLoader";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip);
type Props = {
	worthScore: WorthScoreData;
	isLoading: boolean;
	showWorthScore?: boolean;
};

const initialData = {
	labels: [
		["Company", "Profile"],
		["Business", "Operations"],
		["Financial", "Trends"],
		["Liquidity"],
		["Public", "Records"],
	],
	datasets: [
		{
			data: [0, 0, 0, 0, 0],
			backgroundColor: ["#D3D3D3", "#D3D3D3", "#D3D3D3", "#D3D3D3", "#D3D3D3"],
			borderWidth: 1,
		},
		{
			data: [100, 100, 100, 100, 100],
			backgroundColor: ["#E7E7E7", "#E7E7E7", "#E7E7E7", "#E7E7E7", "#E7E7E7"],
			borderWidth: 1,
		},
	],
};

const WorthScoreBarChart = ({
	worthScore,
	isLoading,
	showWorthScore = true,
}: Props) => {
	const staticLabels = [
		"Company Profile",
		"Business Operations",
		"Financial Trends",
		"Liquidity",
		"Public Records",
	];
	const lagendColors = [
		"#000755",
		"#2973A8",
		"#5529A8",
		"#9E29A8",
		"#00075566",
	];
	const [data, setData] = useState(initialData);

	const options: any = {
		responsive: true,
		maintainAspectRatio: false,
		plugins: {
			legend: false,
			title: {
				display: false,
			},
			tooltip: {
				callbacks: {
					title: (context: any) => {
						return null;
					},
					label: (context: any) => {
						return ` ${context.label.replaceAll(",", " ") as string} - ${
							data.datasets[0].data[context.dataIndex]
						}% `;
					},
					labelColor: (context: any) => {
						return {
							backgroundColor: lagendColors[context.dataIndex],
						};
					},
				},
			},
		},
		scales: {
			x: {
				stacked: true,
				display: false,
				grid: {
					display: false,
				},
			},
			y: {
				stacked: true,
				min: 0,
				max: 100,
				ticks: {
					stepSize: 20,
					callback: (value: string) => {
						return `${value}%`;
					},
				},
			},
		},
	};
	useEffect(() => {
		if (showWorthScore) {
			setData({
				...data,
				datasets: [
					{
						data: [0, 0, 0, 0, 0, 0, 0],
						backgroundColor: [
							"#000755",
							"#2973A8",
							"#5529A8",
							"#9E29A8",
							"#00075566",
						],
						borderWidth: 1,
					},
					{
						data: [100, 100, 100, 100, 100, 100, 100],
						backgroundColor: [
							"#E7E7E7",
							"#E7E7E7",
							"#E7E7E7",
							"#E7E7E7",
							"#E7E7E7",
						],
						borderWidth: 1,
					},
				],
			});
		} else if (worthScore?.is_score_calculated) {
			const labels = worthScore?.score_distribution?.map((score) => {
				return [score?.label, score?.score];
			});
			labels.push(["Public Records", 75]);
			const percentages = Array(staticLabels.length).fill(0);
			labels.forEach(([key, value]) => {
				const index = staticLabels.indexOf(key as string);
				if (index !== -1) {
					percentages[index] = Number(value);
				}
			});
			const blankPercentage = percentages?.map(
				(percentage) => 100 - percentage,
			);
			setData({
				...data,
				datasets: [
					{
						data: percentages,
						backgroundColor: [
							"#000755",
							"#2973A8",
							"#5529A8",
							"#9E29A8",
							"#00075566",
						],
						borderWidth: 1,
					},
					{
						data: blankPercentage,
						backgroundColor: [
							"#E7E7E7",
							"#E7E7E7",
							"#E7E7E7",
							"#E7E7E7",
							"#E7E7E7",
						],
						borderWidth: 1,
					},
				],
			});
		}
	}, [worthScore, showWorthScore]);

	return (
		<>
			{isLoading && <FullPageLoader />}
			{showWorthScore ? (
				<div className="max-w-md mx-auto overflow-hidden bg-white rounded-xl">
					<div className="md:flex h-[240px] w-[380px]">
						<Bar height={300} data={data} options={options} />
					</div>
				</div>
			) : (
				<>
					<div className="max-w-md mx-auto overflow-hidden bg-white rounded-xl">
						<div className="md:flex h-[240px] w-[380px]">
							<Bar height={300} data={data} options={options} />
						</div>
					</div>
					<div className="text-sm text-red-600 transform -translate-y-48">
						<div className="flex justify-center w-full">
							<ExclamationTriangleIcon className="h-8 w-9" strokeWidth={0.9} />
						</div>
						<div className="flex flex-col items-center content-center justify-center w-full align-middle ">
							<p>A Worth score could not be</p>
							<p>generated due to lack of data.</p>
						</div>
					</div>
				</>
			)}
			<div className="grid flex-grow-0 grid-cols-1 mt-8 ml-12 sm:grid-cols-2">
				{staticLabels.map((val, index) => (
					<div className="flex" key={index}>
						<div
							className="w-3 h-8 my-1"
							style={{ backgroundColor: lagendColors[index] }}
						></div>
						<div className="ml-1 mt-3 h-8 text-xs text-[#474747] ">
							{capitalize(val)}
						</div>
					</div>
				))}
			</div>
		</>
	);
};

export default memo(WorthScoreBarChart);
