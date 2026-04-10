import React, { type InputHTMLAttributes } from "react";
import {
	Controller,
	type FieldErrors,
	type FieldValues,
	type UseFormRegister,
} from "react-hook-form";

export interface Props<
	T extends FieldValues = FieldValues,
	U extends FieldValues = FieldValues,
> extends InputHTMLAttributes<HTMLTextAreaElement> {
	// Changed to HTMLTextAreaElement
	placeholder?: string;
	defaultValue?: string;
	rows?: number;
	name: string;
	id: string;
	register?: UseFormRegister<T>;
	errors?: FieldErrors<U>;
	icons?: React.ReactElement[];
	footerText?: string;
	onChange?: (e: any) => void;
	value?: string;
	label?: string;
	isRequired?: boolean;
	control?: any;
}

const TextArea = <T extends FieldValues, U extends FieldValues>({
	placeholder,
	defaultValue,
	rows,
	name,
	id,
	errors,
	register,
	onChange,
	value,
	label,
	isRequired,
	control,
}: Props<T, U>) => {
	return (
		<div className="flex flex-col">
			<label className="block text-xs font-medium leading-6 text-gray-900 whitespace-nowrap font-Inter">
				{label ?? ""}
				{isRequired && <span className="text-sm text-red-600">*</span>}
			</label>
			<span className="relative flex flex-col w-full min-w-0">
				<Controller
					name={name}
					control={control}
					defaultValue={defaultValue}
					render={({ field }) => (
						<textarea
							{...field}
							id={id}
							rows={rows}
							placeholder={placeholder ?? ""}
							className="block w-full p-2 px-4 py-3 pb-10 my-1 mt-3 text-gray-900 border border-gray-300 rounded-lg appearance-none resize-none focus:outline-none focus:border-3 focus:border-black placeholder:text-gray-400 sm:text-sm sm:leading-6"
						/>
					)}
				/>
			</span>
			{errors && errors[name as keyof U] && (
				<p className="mt-2 text-sm text-red-600" id="email-error">
					{errors[name as keyof U]?.message as string}
				</p>
			)}
		</div>
	);
};

export default TextArea;
