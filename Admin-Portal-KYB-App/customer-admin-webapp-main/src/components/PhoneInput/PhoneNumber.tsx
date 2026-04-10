import React from "react";
import { Controller } from "react-hook-form";
import PhoneInput from "react-phone-number-input";
import { twMerge } from "tailwind-merge";
import "react-phone-number-input/style.css";

type Tagged<A, T> = A & { __tag?: T };

type E164Number = Tagged<string, "E164Number">;

interface PhoneNumberProps {
	label: string;
	value: string | undefined;
	onChange?: (value?: E164Number | undefined) => void;
	isRequired?: boolean;
	error: string;
	placeholder?: string;
	disabled?: boolean;
	labelClassName?: string;
	control: any; // add control prop
	name: string; // add name prop
	className?: string;
	international?: boolean;
	countryCallingCodeEditable?: boolean;
}

const defaultClasses = `
block
w-full
rounded-md
border-0
h-[44px]
px-2
py-1.5
text-gray-900
shadow-sm
ring-1
ring-inset
ring-gray-300
placeholder:text-gray-400
focus:ring-2
focus:ring-inset
focus:ring-indigo-600
sm:text-sm
sm:leading-6
w-full
rounded-md
  `;

const PhoneNumber: React.FC<PhoneNumberProps> = ({
	label,
	value,
	onChange,
	error,
	placeholder,
	isRequired = false,
	disabled,
	labelClassName,
	control,
	name,
	className,
	international = false,
	countryCallingCodeEditable = true,
}) => {
	return (
		<div className="flex flex-col">
			<label
				className={twMerge(
					"text-sm font-medium text-gray-900 block leading-6",
					labelClassName,
				)}
			>
				{label ?? ""}
				{isRequired && <span className="text-sm text-red-600">*</span>}
			</label>
			<div className="relative">
				<div className={className ? "contents" : defaultClasses}>
					<Controller
						control={control}
						name={name}
						defaultValue=""
						render={({ field }) => (
							<PhoneInput
								placeholder={placeholder ?? "Enter phone number"}
								country="US"
								countries={["US"]}
								className={twMerge(
									"custom-phone",
									error ? "error" : "",
									className,
								)}
								defaultCountry="US"
								limitMaxLength={true}
								countrySelectProps={{ disabled: true }}
								value={field.value}
								disabled={disabled ?? false}
								onChange={field.onChange}
								isValidPhoneNumber={true}
								international={international}
								countryCallingCodeEditable={countryCallingCodeEditable}
							/>
						)}
					/>
				</div>
				{error && (
					<p className="mt-2 text-sm text-red-600" id="email-error">
						{error}
					</p>
				)}
			</div>
		</div>
	);
};

export default PhoneNumber;
