import React from "react";
import { twMerge } from "tailwind-merge";

type Props = {
	value: boolean;
	onChange: () => void;
	disabled?: boolean;
};
const Toggle: React.FC<Props> = ({ value, onChange, disabled }) => {
	return (
		<label className="inline-flex items-center cursor-pointer">
			<input
				type="checkbox"
				checked={value}
				className="sr-only peer"
				onChange={() => {
					if (!disabled) onChange();
				}}
				disabled={disabled}
			/>
			<div
				className={twMerge(
					"relative w-11 h-6 bg-[#D5D8DF] peer-active:outline-none peer-active:ring-4 peer-active:ring-blue-300  rounded-full peer  peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all border-gray-600 peer-checked:bg-blue-600",
					disabled && "opacity-60 cursor-not-allowed",
				)}
			></div>
		</label>
	);
};

export default Toggle;
