import React from "react";

interface CircularProgressProps {
	value: number;
	total: number;
	count: number;
}

const CircularProgress = ({ value, total, count }: CircularProgressProps) => {
	const radius = 100;
	const stroke = 15;
	const normalizedRadius = radius - stroke * 0.5;
	const circumference = normalizedRadius * 2 * Math.PI;
	const strokeDashoffset = circumference * (1 - value / total);

	return (
		<div className="relative flex flex-col items-center justify-center w-[200px] h-[200px]">
			{/* Background circle */}
			<svg
				height={radius * 2}
				width={radius * 2}
				className="transform -rotate-90 absolute top-0 left-0"
			>
				<circle
					stroke="#E5E7EB"
					fill="transparent"
					strokeWidth={stroke}
					r={normalizedRadius}
					cx={radius}
					cy={radius}
				/>
			</svg>

			{/* Progress circle */}
			<svg
				height={radius * 2}
				width={radius * 2}
				className="transform -rotate-90 absolute top-0 left-0"
			>
				<circle
					stroke="#2563EB"
					fill="transparent"
					strokeWidth={stroke}
					strokeLinecap="round"
					strokeDasharray={`${circumference} ${circumference}`}
					strokeDashoffset={strokeDashoffset}
					r={normalizedRadius}
					cx={radius}
					cy={radius}
				/>
			</svg>

			<div className="absolute flex flex-col items-center justify-center text-center">
				<span className="text-2xl font-semibold">{count.toLocaleString()}</span>
				<span className="text-gray-500 text-sm">New Onboardings</span>
			</div>
		</div>
	);
};

export default CircularProgress;
