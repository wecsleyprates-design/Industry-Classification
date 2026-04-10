import { type ChangeEventHandler } from "react";
import {
	type FieldErrors,
	type FieldValues,
	type UseFormRegister,
} from "react-hook-form";
import { cn } from "@/lib/utils";

type PrefixInput = {
	prefix: string;
	suffix?: never;
	textAlign?: "right";
};

type SuffixInput = {
	suffix: string;
	prefix?: never;
	textAlign?: "left";
};

type FormattedInputProps<T extends FieldValues> = (
	| PrefixInput
	| SuffixInput
) & {
	name: any;
	register: UseFormRegister<T>;
	errors?: FieldErrors<T>;
	validationSchema?: any;
	label?: string;
	labelClassName?: string;
	placeholder?: string;
	disabled?: boolean;
	type?: "text" | "number";
	isRequired?: boolean;
	id?: string;
	className?: string;
	onChange: ChangeEventHandler<HTMLInputElement> | undefined;
};

const FormattedInput = <T extends FieldValues>({
	prefix,
	suffix,
	name,
	register,
	errors,
	validationSchema,
	label,
	labelClassName,
	placeholder,
	disabled = false,
	type = "text",
	isRequired = false,
	id,
	onChange,
	className,
	...props
}: FormattedInputProps<T>) => {
	const inputClassName = `
    w-full
    rounded-lg
    border
		mt-2.5
    border-gray-200
    font-Inter
    text-sm
    text-gray-800
    h-10
    focus:outline-none
    focus:ring-1
    focus:ring-blue-500
    disabled:bg-gray-50
    disabled:cursor-not-allowed
    ${prefix ? "text-right pr-3 pl-7" : ""}
    ${suffix ? "text-left pl-3 pr-7" : ""}
    ${errors?.[name] ? "border-red-500 focus:ring-red-500" : ""}
  `;

	return (
		<div className={cn("flex flex-col")}>
			{label && (
				<label
					htmlFor={id}
					className={`block text-xs font-medium leading-6 text-gray-900 whitespace-nowrap font-Inter ${
						labelClassName ?? ""
					}`}
				>
					{label}
					{isRequired && (
						<span className="text-sm text-red-600">*</span>
					)}
				</label>
			)}
			<div className={cn("relative", className)}>
				{prefix && (
					<div className="absolute inset-y-0 left-0 top-[30px] transform -translate-y-1/2 flex items-center pl-3 text-gray-500 font-extralight pointer-events-none">
						{prefix}
					</div>
				)}
				<input
					id={id}
					{...register(name, validationSchema)}
					type={type}
					placeholder={placeholder}
					disabled={disabled}
					className={inputClassName}
					onChange={onChange}
					{...props}
				/>
				{suffix && (
					<div className="text-xs absolute font-semibold inset-y-0 right-0 top-[30px] transform -translate-y-1/2 flex items-center pr-3 text-gray-500 pointer-events-none">
						{suffix}
					</div>
				)}
			</div>
			{errors?.[name] && (
				<p className="mt-2 text-sm text-red-600">
					{errors[name]?.message as string}
				</p>
			)}
		</div>
	);
};

export default FormattedInput;
