import React from "react";

type Props = {
	value: boolean;
	onChange: (event?: any) => void;
	disabled?: boolean;
};
const Toggle: React.FC<Props> = ({ value, onChange, disabled }) => {
	return (
		<label className="inline-flex items-center cursor-pointer">
			<input
				type="checkbox"
				checked={value}
				className="sr-only peer"
				onChange={(event: any) => {
					if (!disabled) onChange(event);
				}}
				disabled={disabled}
			/>
			<div className="relative w-11 h-6 bg-[#D5D8DF] peer-active:outline-none peer-active:ring-4 peer-active:ring-blue-300  rounded-full peer  peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all Fborder-gray-600 peer-checked:bg-blue-600"></div>
		</label>
	);
};

export default Toggle;
