import React, { useState } from "react";
import PI, { type PhoneInputProps } from "react-phone-input-2";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { twMerge } from "tailwind-merge";
import { ReactCustomTooltip } from "@/components/Tooltip";
import "react-phone-input-2/lib/style.css";

type Tagged<A, T> = A & { __tag?: T };

type E164Number = Tagged<string, "E164Number">;

interface PhoneNumberProps {
	label: string;
	value: string | undefined | null;
	onChange: (value?: E164Number | undefined) => void;
	isRequired?: boolean;
	error?: any;
	disabled?: boolean;
	placeholder?: string;
	labelClassName?: string;
	onblur: any;
	tooltip?: string;
	interName?: string;
}

const defaultClasses = `
block
w-full
rounded-md
border
px-2
py-2.5
mt-1
h-12
text-gray-900
sm:text-base
sm:leading-6
w-full
rounded-md
hover:shadow-[0_0_0_2px_#F3F4F6]
  `;

const PhoneNumber: React.FC<PhoneNumberProps> = ({
	label,
	value,
	onChange,
	error,
	placeholder,
	disabled,
	isRequired = false,
	onblur,
	tooltip,
	interName,
}) => {
	const PhoneInput: React.FC<PhoneInputProps> = (PI as any).default || PI;
	let valueNumber;
	if (value?.startsWith("+1")) valueNumber = value.substring(2);
	else valueNumber = value;
	const [isFocused, setIsFocused] = useState(false);
	const handleBlur = (event: React.FocusEvent) => {
		setIsFocused(false);
		if (onblur) {
			onblur(event);
		}
	};
	return (
		<div className="flex flex-col">
			<label
				htmlFor="email"
				className="block text-xs font-medium leading-6 text-gray-900 font-Inter"
			>
				{label ?? ""}
				{tooltip && (
					<ReactCustomTooltip id={interName ?? label} tooltip={<>{tooltip}</>}>
						<InformationCircleIcon className="min-w-3.5 max-w-3.5 text-gray-500 mx-1" />
					</ReactCustomTooltip>
				)}
				{isRequired && <span className="text-sm text-red-600">*</span>}
			</label>
			<div className="relative mt-1 border-none rounded-md">
				<div
					className={twMerge(
						defaultClasses,
						value ? "border" : "border-2",
						isFocused ? "shadow-[0_0_0_2px_#F3F4F6]" : "",
						disabled ? "bg-gray-50" : "bg-white",
					)}
				>
					<PhoneInput
						onKeyDown={(e) => {
							if (e?.key === "Enter") {
								e?.preventDefault();
							}
						}}
						onBlur={handleBlur}
						containerStyle={{
							border: "none",
						}}
						inputStyle={{
							width: "100%",
							border: "none",
							height: "max-content",
							fontSize: 14,
							background: disabled ? "#f9fafb" : "white",
						}}
						onFocus={() => {
							setIsFocused(true);
						}}
						buttonStyle={{
							border: "none",
							color: "transparent",
							backgroundColor: "transparent",
						}}
						placeholder={placeholder ?? "Enter phone number"}
						country={"us"}
						onlyCountries={["us"]}
						value={valueNumber}
						disableCountryCode
						disableDropdown
						disabled={disabled}
						onChange={onChange}
					/>
				</div>
				{error && (
					<p className="mt-2 text-sm text-red-600" id="email-error">
						{error.message}
					</p>
				)}
			</div>
		</div>
	);
};

export default PhoneNumber;
