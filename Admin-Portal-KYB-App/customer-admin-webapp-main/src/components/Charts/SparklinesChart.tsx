import React from "react";
import { Line } from "react-chartjs-2";
import {
	CategoryScale,
	Chart as ChartJS,
	LinearScale,
	LineElement,
	Title,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, LineElement, Title);

type Props = {
	data?: any;
};

const SparklinesChart: React.FC<Props> = ({ data }) => {
	const options: any = {
		responsive: true,
		maintainAspectRatio: false,
		plugins: {
			legend: false,
			tooltip: false,
		},
		scales: {
			x: {
				display: false,
			},
			y: {
				display: false,
			},
		},
	};

	return (
		<div>
			<div className="w-12 h-12">
				<Line
					data={{
						labels: [
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
						],
						datasets: [
							{
								data: data ?? [],
								borderColor: "#266EF1",
								borderWidth: 2,
								tension: 0.4,
								pointRadius: 0,
							},
						],
					}}
					options={options}
				/>
			</div>
		</div>
	);
};

export default SparklinesChart;
