import React from "react";
import { type Control, Controller } from "react-hook-form";
import PhoneInput from "react-phone-input-2";
import { cn } from "@/lib/utils";
import "react-phone-input-2/lib/style.css";

interface PhoneNumberInputProps {
	label: string;
	defaultValue: string | undefined;
	name: string;
	control: Control<any>;
	isRequired?: boolean;
	error: string;
	placeholder?: string;
	labelClassName?: string;
	disabled?: boolean;
}

const defaultClasses = `
block
px-2
py-2.5 border border-[#DFDFDF] rounded-md
bg-white 
h-[44px]
sm:text-base
`;

const PhoneNumberInput: React.FC<PhoneNumberInputProps> = ({
	label,
	error,
	placeholder,
	defaultValue,
	control,
	name,
	isRequired = false,
	disabled = false,
}) => {
	return (
		<div className="flex flex-col">
			<label
				htmlFor={name}
				className="block text-sm font-normal leading-6 text-gray-900"
			>
				{label ?? ""}
				{isRequired && <span className="text-sm text-red-600">*</span>}
			</label>
			<div className="relative rounded-md">
				<div
					className={cn(
						defaultClasses,
						disabled && "bg-gray-50 cursor-not-allowed",
					)}
				>
					<Controller
						name={name}
						control={control}
						defaultValue={defaultValue}
						render={({ field }) => (
							<PhoneInput
								containerClass="my-container-class"
								inputClass={cn(
									"my-input-class",
									disabled && "cursor-not-allowed bg-gray-50",
								)}
								containerStyle={{
									border: "none",
								}}
								inputStyle={{
									width: "100%",
									border: "none",
									height: "max-content",
									borderRadius: "18px !important",
									...(disabled && {
										backgroundColor: "#f9fafb",
										cursor: "not-allowed",
									}),
								}}
								buttonStyle={{
									border: "none",
									...(disabled && {
										cursor: "not-allowed",
									}),
								}}
								placeholder={placeholder ?? "Enter phone number"}
								country={"us"}
								onlyCountries={["us"]}
								value={field.value}
								onChange={field.onChange}
								disabled={disabled}
							/>
						)}
					/>
				</div>
				{error && (
					<p className="mt-2 text-sm text-red-600" id={`${name}-error`}>
						{error}
					</p>
				)}
			</div>
		</div>
	);
};

export default PhoneNumberInput;
