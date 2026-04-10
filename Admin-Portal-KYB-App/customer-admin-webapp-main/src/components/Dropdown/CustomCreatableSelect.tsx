import React from "react";
import { Controller } from "react-hook-form";
import CreatableSelect from "react-select/creatable";

type Props = {
	control: any;
	name: string;
	label: string;
	isAstrik: boolean;
	isLoading: boolean;
	options: any;
	error: string;
	onChange: (value: any) => void;
	defaultValue?: any;
};

const defaultClasses = `
block
mt-2
w-full
rounded-md
border-0
py-1
px-1
text-gray-900
shadow-sm
ring-1
ring-inset
ring-gray-300
placeholder:text-gray-400
focus:ring-2
focus:ring-inset
sm:text-sm
sm:leading-6
w-full
  `;
const CustomCreatableSelect: React.FC<Props> = ({
	control,
	name,
	label,
	options,
	isAstrik,
	isLoading,
	error,
	onChange,
	defaultValue,
}) => {
	return (
		<div>
			<label htmlFor="email" className={`block leading-6`}>
				{isAstrik ? (
					<>
						<>
							{label}
							<span style={{ color: "red" }}>*</span>
						</>
					</>
				) : (
					<> {label ?? ""}</>
				)}
			</label>
			<Controller
				name={name}
				control={control}
				defaultValue={defaultValue}
				render={({ field }) => (
					<>
						<CreatableSelect
							{...field}
							className={defaultClasses}
							isLoading={isLoading}
							options={options}
							styles={{
								control: (baseStyles, state) => ({
									...baseStyles,
									borderColor: "transparent",
									boxShadow: "none",
									"&:hover": {
										borderColor: "white",
									},
									"&:active": {
										borderColor: "white",
									},
								}),
							}}
							classNamePrefix="react-select"
							isClearable
							onChange={(value) => {
								onChange(value);
								field.onChange(value);
							}}
						/>
						<>
							{error ? (
								<p className="mt-2 text-sm text-red-600" id="email-error">
									{error}
								</p>
							) : null}
						</>
					</>
				)}
			/>
		</div>
	);
};

export default CustomCreatableSelect;
