import React, { type InputHTMLAttributes, useEffect, useRef } from "react";
import {
	type FieldErrors,
	type FieldValues,
	type Path,
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
	maxcharlength?: number;
}

// Custom hook for auto-resizing text area
function useAutoResizeTextArea(value: string) {
	const textAreaRef = useRef<HTMLTextAreaElement>(null);

	useEffect(() => {
		const textArea = textAreaRef.current;
		if (textArea) {
			textArea.style.height = "auto";
			textArea.style.height = `${textArea.scrollHeight}px`;
		}
	}, [value]);

	return textAreaRef;
}

const TextArea = <T extends FieldValues, U extends FieldValues>({
	placeholder,
	defaultValue,
	rows,
	name,
	id,
	icons,
	footerText,
	errors,
	register,
	onChange,
	value,
	maxcharlength = 500,
}: Props<T, U>) => {
	const textAreaRef = useAutoResizeTextArea(value ?? "");

	return (
		<>
			<span className="relative flex flex-col w-full min-w-0">
				<div className="pl-1 z-10 rounded-lg border  border-[#D1D5DB]">
					{/* In future this needs to be removed and make register required,
					 but as of now we have textArea in multiple places therfore added */}
					{register ? (
						<textarea
							id={id}
							rows={rows}
							maxLength={maxcharlength}
							placeholder={placeholder ?? ""}
							className="block w-full px-4 py-3 pb-10 my-1 text-gray-900 border-0 resize-none placeholder:text-gray-400 sm:text-sm sm:leading-6"
							defaultValue={defaultValue ?? ""}
							{...register(name as Path<T>)}
							ref={textAreaRef}
							onChange={onChange}
						/>
					) : (
						<textarea
							id={id}
							rows={rows}
							maxLength={maxcharlength}
							placeholder={placeholder ?? ""}
							className="block w-full px-4 py-3 pb-10 my-1 text-gray-900 border-0 resize-none placeholder:text-gray-400 sm:text-sm sm:leading-6"
							defaultValue={defaultValue ?? ""}
							ref={textAreaRef}
							value={value}
							onChange={onChange}
						/>
					)}
				</div>

				<span className="text-gray-500">{footerText}</span>
			</span>
			{errors && errors[name as keyof U] && (
				<p className="mt-2 text-sm text-red-600" id="email-error">
					{errors[name as keyof U]?.message as string}
				</p>
			)}
		</>
	);
};

export default TextArea;
