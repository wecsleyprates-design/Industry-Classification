import React, { type InputHTMLAttributes, useEffect, useRef } from "react";
import {
	type FieldErrors,
	type FieldValues,
	useController,
} from "react-hook-form";
import classNames from "classnames";

export interface Props<
	U extends FieldValues = FieldValues,
> extends InputHTMLAttributes<HTMLInputElement> {
	name: string;
	control: any;
	count: number;
	label: string;
	isRequired: boolean;
	errors?: FieldErrors<U>;
}

const OTPInput = <U extends FieldValues>({
	name,
	control,
	count,
	errors,
	label,
	isRequired,
}: Props<U>) => {
	const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
	const { field } = useController({
		name,
		control,
		defaultValue: "",
	});
	useEffect(() => {
		if (field.value?.length > count) {
			field.onChange(field.value.slice(0, count));
		}
	}, [field.value, count, field.onChange]);

	const handleInputChange = (index: number, value: string) => {
		if (value && index < count - 1 && inputsRef.current[index + 1]) {
			inputsRef.current[index + 1]?.focus();
		}
		const newValues = [...field.value];
		newValues[index] = value;
		field.onChange(newValues.join(""));
	};

	const handleBackSpace = (
		index: number,
		value: string,
		event: React.KeyboardEvent<HTMLInputElement>,
	) => {
		if (!value && index > 0 && event.key === "Backspace") {
			inputsRef.current[index - 1]?.focus();
			const newValues = [...field.value];
			newValues[index - 1] = "";
			field.onChange(newValues.join(""));
		}
	};
	const pasteHandler = () => {
		inputsRef.current[inputsRef.current.length - 1]?.focus();
	};

	return (
		<div>
			<label className="block text-xs m-1 font-medium text-gray-900">
				{label ?? ""}
				{isRequired && <span className="text-sm text-red-600">*</span>}
			</label>
			<div className="flex w-full">
				{Array.from({ length: count }).map((_, index) => (
					<input
						onPaste={pasteHandler}
						key={index}
						type="number"
						className={classNames(
							"w-8 h-8 sm:w-10 sm:h-10 m-[2px] sm:m-1 text-center flex rounded-md border-0 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6",
						)}
						maxLength={1}
						ref={(input) => {
							inputsRef.current[index] = input;
						}}
						value={(field.value || [])[index] || ""}
						onChange={(e) => {
							handleInputChange(index, e.target.value);
						}}
						onKeyDown={(e) => {
							handleBackSpace(index, field.value[index] || "", e);
						}}
					/>
				))}
			</div>
			{errors && errors[name as keyof U] && (
				<p className="mt-2 text-sm text-red-600" id="email-error">
					{errors[name as keyof U]?.message as string}
				</p>
			)}
		</div>
	);
};

export default OTPInput;
