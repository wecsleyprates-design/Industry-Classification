import { memo, useEffect, useMemo, useState } from "react";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { twMerge } from "tailwind-merge";
import WaterfallChart from "@/components/Charts/WaterfallChart";
import FullPageLoader from "@/components/Spinner/FullPageLoader";
import { capitalize } from "@/lib/helper";
import {
	type ScoreDistribution,
	type WorthScoreData,
} from "@/types/worthScore";

const lagendColors = [
	"#BD7CFF",
	"#000755",
	"#2973A8",
	"#5529A8",
	"#9E29A8",
	"#7E82AA",
	"#FF6FBC",
];

const valueRanges = [50, 150, 250, 350];

type Props = {
	worthScore?: WorthScoreData;
	isLoading: boolean;
	showWorthScore?: boolean;
};

const sortScore = (scoreDestributions?: ScoreDistribution[]) => {
	return (
		scoreDestributions?.sort((a, b) => {
			const scoreA = a.score_850;
			const scoreB = b.score_850;

			// First, sort by positive vs negative
			if (scoreA >= 0 && scoreB < 0) {
				return -1;
			}
			if (scoreA < 0 && scoreB >= 0) {
				return 1;
			}
			// Then sort positive values in ascending order
			if (scoreA >= 0 && scoreB >= 0) {
				return scoreA - scoreB;
			}
			// Finally, sort negative values in ascending order
			return scoreA - scoreB;
		}) ?? []
	);
};

const WorthScoreWaterfallChart = ({
	worthScore,
	isLoading,
	showWorthScore = true,
}: Props) => {
	const [barsData, setBarsData] = useState<number[][]>([]);
	const [labels, setLabels] = useState<string[]>([]);
	const [yMax, setYMax] = useState<number>(850);
	const [yMin, setYMin] = useState<number>(350);
	const [connectorLabelData, setConnectorLabelData] = useState<
		Array<{ x: string; y: number }>
	>([]);
	const [connectorData, setConnectorData] = useState<
		Array<{ x: string; y: number }>
	>([]);

	const [tooltips, setTooltips] = useState<
		Array<{
			title: string;
			factors: Array<{ title: string; value: number }>;
		}>
	>([]);

	const minScoreValue = useMemo(
		() =>
			valueRanges.findLast(
				(val) => val <= Number(worthScore?.weighted_score_850),
			),
		[worthScore],
	);

	useEffect(() => {
		if (!showWorthScore) {
			setBarsData([
				[0, 0],
				[0, 0],
				[0, 0],
				[0, 0],
				[0, 0],
				[0, 0],
				[0, 0],
			]);
			setConnectorData([
				{
					x: "Base Score",
					y: 0,
				},
				{
					x: "Base Score",
					y: 0,
				},
				{
					x: "Performance Measures",
					y: 0,
				},
				{
					x: "Performance Measures",
					y: 0,
				},
				{
					x: "Financial Trends",
					y: 0,
				},
				{
					x: "Financial Trends",
					y: 0,
				},
				{
					x: "Company Profile",
					y: 0,
				},
				{
					x: "Company Profile",
					y: 0,
				},
				{
					x: "Public Records",
					y: 0,
				},
				{
					x: "Public Records",
					y: 0,
				},
				{
					x: "Business Operations",
					y: 0,
				},
				{
					x: "Business Operations",
					y: 0,
				},
				{
					x: "Worth Score",
					y: 0,
				},
			]);
			setLabels([
				"Base Score",
				"Performance Measures",
				"Financial Trends",
				"Company Profile",
				"Public Records",
				"Business Operations",
				"Worth Score",
			]);
		} else if (
			worthScore?.weighted_score_850 &&
			worthScore?.is_score_calculated
		) {
			// sorting score components
			const scoreDestribution = sortScore(worthScore?.score_distribution);
			// labels
			const tLabels = ["Base Score"];
			scoreDestribution
				.map((v) => v.label)
				.forEach((value) => tLabels.push(value));
			tLabels.push("Worth Score");
			setLabels(tLabels);
			// bar data
			/*
			[350, 470],[470, 540],[540, 619],[619, 601],[601, 678],[678, 708],[708, 350],					
			*/
			const tScores1: number[] =
				scoreDestribution.map((v) => Number(v.score_850)) ?? [];
			const tBarsData = [];

			let start = Number(worthScore.base_score);
			tScores1?.reduce((total: number, score) => {
				if (total + score > 850) {
					setYMax(950);
				} else if (total + score < 350) {
					setYMin(250);
				}
				return total + score;
			}, start);

			tBarsData.push([
				typeof minScoreValue === "number"
					? yMin < 0
						? yMin
						: minScoreValue
					: yMin,
				Number(worthScore.base_score),
			]);
			for (const value of tScores1) {
				const end = start + value;
				tBarsData.push([start, end]);
				start = end;
			}
			tBarsData.push([
				Number(worthScore.weighted_score_850),
				typeof minScoreValue === "number"
					? yMin < 0
						? yMin
						: minScoreValue
					: yMin,
			]);
			setBarsData(tBarsData);
			const numberedVals = [];
			for (let i = 0; i < tBarsData.length; i++) {
				numberedVals.push(tBarsData[i][0]);
				numberedVals.push(tBarsData[i][1]);
			}

			const tConnectorData: Array<{ x: string; y: number }> = [];
			for (let i = 0; i < tBarsData.length - 1; i++) {
				const label = tLabels[i];
				const [start, end] = tBarsData[i];
				if (start !== 0 || end !== 0) {
					if (start === end) {
						tConnectorData.push({
							x: label,
							y: start,
						});
						tConnectorData.push({
							x: label,
							y: end,
						});
					} else if (start < end) {
						tConnectorData.push({
							x: label,
							y: label === "Base Score" ? start - 1 : start + 1,
						});
						tConnectorData.push({
							x: label,
							y: label === "Base Score" ? end - 1 : end - 1,
						});
					} else {
						tConnectorData.push({
							x: label,
							y: label === "Base Score" ? start - 1 : start - 1,
						});
						tConnectorData.push({
							x: label,
							y: label === "Base Score" ? end - 1 : end + 1,
						});
					}
				}
			}
			tConnectorData.push({
				x: "Worth Score",
				y: Number(worthScore.weighted_score_850) - 1,
			});
			setConnectorData(tConnectorData);

			const tConnectorLabelData: Array<{ x: string; y: number }> = [];
			for (let i = 0; i < tBarsData.length - 1; i++) {
				const label = tLabels[i];
				const [start, end] = tBarsData[i];

				if (start !== 0 || end !== 0) {
					tConnectorLabelData.push({ x: label, y: start });
					tConnectorLabelData.push({ x: label, y: end });
				}
			}
			tConnectorLabelData.push({
				x: "Worth Score",
				y: Number(worthScore.weighted_score_850),
			});
			setConnectorLabelData(tConnectorLabelData);

			// tooltip
			const tTooltip: Array<{
				title: string;
				factors: Array<{ title: string; value: number }>;
			}> = [
				{
					title: "Base Score",
					factors: [],
				},
			];
			scoreDestribution
				.map((value) => {
					return {
						title: value.label ?? "",
						factors:
							value?.factors?.map((v) => {
								return {
									title: v.label ?? "",
									value: Number(v.weighted_score_850 ?? 0),
								};
							}) ?? [],
					};
				})
				.forEach((t) => tTooltip.push(t));
			tTooltip.push({
				title: "Worth Score",
				factors: [],
			});
			setTooltips(tTooltip);
		} else {
			setLabels([
				"Base Score",
				"Company Profile",
				"Public Records",
				"Financial Trends",
				"Business Operations",
				"Performance Measures",
				"Worth Score",
			]);
		}
	}, [worthScore, minScoreValue, yMin, showWorthScore]);

	return (
		<>
			{isLoading && <FullPageLoader />}
			<div className="max-w-md mx-auto overflow-hidden bg-white rounded-xl ">
				<div className="w-[350px]">
					<WaterfallChart
						showWorthScore={showWorthScore}
						chartOptions={{
							y: {
								min:
									typeof minScoreValue === "number"
										? yMin < 0
											? yMin
											: minScoreValue
										: yMin,
								max: yMax,
								stepSize: 100,
							},
							x: {
								display: false,
							},
							labels: true,
							hideLegends: true,
						}}
						tooltips={tooltips}
						data={{
							labels,
							datasets: [
								{
									datalabels: {
										color: "#000",
										align: "start",
										clamp: false,
										anchor: "start",
										offset: 5,
										formatter: function (value: any, context: any) {
											let renderValue: string | number = "";
											if (
												context.dataIndex !== 0 &&
												context.dataIndex !== context.dataset.data.length - 1
											)
												renderValue =
													context.dataset.data[context.dataIndex]?.[1] -
													context.dataset.data[context.dataIndex - 1]?.[1];
											else if (context.dataIndex === 0) {
												renderValue =
													context.dataset.data[context.dataIndex]?.[1];
											} else if (context.dataIndex === 1) {
												renderValue =
													context.dataset.data[context.dataIndex]?.[1] - 1;
											} else if (
												context.dataIndex ===
												context.dataset.data.length - 1
											) {
												renderValue =
													context.dataset.data[context.dataIndex - 1]?.[1];
											}
											renderValue = Number(renderValue);
											return renderValue < 0
												? Math.round(renderValue) || ""
												: "";
										},
									},
									data: barsData,
									backgroundColor: [
										"#BD7CFF",
										"#000755",
										"#2973A8",
										"#5529A8",
										"#9E29A8",
										"#7E82AA",
										"#FF6FBC",
									],
									borderWidth: 4,
									borderSkipped: true,
								},
								{
									type: "line",
									datalabels: {
										color: "#000",
										align: "end",
										clamp: false,
										anchor: "end",
										offset: 3,
										formatter: function (value: any, context: any) {
											let renderValue: string | number = "";

											if (
												context?.dataIndex !== 1 &&
												context?.dataIndex !== 2 &&
												context?.dataIndex !== connectorLabelData?.length - 1
											) {
												renderValue =
													connectorLabelData?.[context?.dataIndex]?.y -
													connectorLabelData?.[context?.dataIndex - 1]?.y;
											} else if (context?.dataIndex === 1) {
												renderValue =
													connectorLabelData?.[context?.dataIndex]?.y - 1;
											} else if (
												context?.dataIndex ===
												connectorLabelData?.length - 1
											) {
												renderValue =
													connectorLabelData?.[context?.dataIndex]?.y;
											}
											renderValue = Number(renderValue ?? 0);
											return renderValue > 0 ? Math.round(renderValue) : "";
										},
									},
									data: connectorData,
									borderColor: "#000",
									borderWidth: 0.7,
									pointBackgroundColor: "rgba(0, 0, 0, 0)",
									pointBorderColor: "rgba(0, 0, 0, 0)",
								},
							],
						}}
					>
						<div className="text-sm text-red-600 transform -translate-y-48">
							<div className="flex justify-center w-full">
								<ExclamationTriangleIcon
									className="h-8 w-9"
									strokeWidth={0.9}
								/>
							</div>
							<div className="flex flex-col items-center content-center justify-center w-full align-middle ">
								<p>A Worth score could not be</p>
								<p>generated due to lack of data.</p>
							</div>
						</div>
					</WaterfallChart>
				</div>
				<div
					className={twMerge(
						"grid flex-grow-0 grid-cols-1 ml-12 sm:grid-cols-2",
						!showWorthScore && "-translate-y-16",
					)}
				>
					{labels.map((val, index) => (
						<div className="flex" key={index}>
							<div
								className="w-3 h-8 my-1"
								style={{ backgroundColor: lagendColors[index] }}
							></div>
							<div className="ml-1 mt-3 h-8 text-xs text-[#474747]">
								{capitalize(val)}
							</div>
						</div>
					))}
				</div>
			</div>
		</>
	);
};

export default memo(WorthScoreWaterfallChart);
