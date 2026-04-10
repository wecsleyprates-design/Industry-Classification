import React from "react";
import "./range.css";

interface Props {
	defaultValue: number;
	value: number;
	onChange: (e: any) => void;
	min?: number;
	max?: number;
	minLabel?: string;
	maxLabel?: string;
}
const Range: React.FC<Props> = ({
	min = 0,
	max = 100,
	defaultValue,
	value,
	onChange,
	minLabel = "0%",
	maxLabel = "100%",
}) => {
	return (
		<>
			<input
				type="range"
				min={min}
				max={max}
				defaultValue={defaultValue}
				value={value}
				onChange={onChange}
				className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
			/>
			<div className="flex justify-between text-sm font-normal">
				<p>{minLabel}</p>
				<p>{maxLabel}</p>
			</div>
		</>
	);
};

export default Range;
