import { type InputHTMLAttributes, type KeyboardEvent } from "react";
import {
	type FieldErrors,
	type FieldValues,
	type Path,
	type UseFormRegister,
} from "react-hook-form";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { twMerge } from "tailwind-merge";
import Spinner from "../Spinner";

export interface Props<
	T extends FieldValues = FieldValues,
	U extends FieldValues = FieldValues,
> extends InputHTMLAttributes<HTMLInputElement> {
	name: string;
	label?: string;
	disabled?: boolean;
	register: UseFormRegister<T>;
	errors?: FieldErrors<U>;
	validationSchema?: any;
	className?: string;
	/**
	 * When you want to show label* for required fields & optional is default
	 */
	isRequired?: boolean;
	children?: React.ReactNode;
	icon?: React.ReactElement;
	tooltip?: string;
	isLoading?: boolean;
}

const defaultClasses = `
block
w-full
rounded-md
py-1.5
text-gray-900
border
ring-inset
border-[#DFDFDF]
placeholder:text-gray-400
sm:text-sm
sm:leading-6
w-full
  `;

const onEventBlur = (event: React.UIEvent<HTMLDivElement>) => {
	event.currentTarget.blur();
};

const handleKeyPress = (event: KeyboardEvent<HTMLInputElement>) => {
	if (event.key === "ArrowUp" || event.key === "ArrowDown") {
		event.preventDefault();
	}
};

const Input = <T extends FieldValues, U extends FieldValues>({
	disabled = false,
	type = "text",
	placeholder,
	errors,
	label,
	name,
	value,
	register,
	validationSchema,
	className,
	children,
	isRequired = false,
	icon,
	tooltip,

	isLoading = false,
	...rest
}: Props<T, U>) => {
	return (
		<div className="flex flex-col">
			<label className="block text-xs font-medium leading-6 text-gray-900 whitespace-nowrap font-Inter">
				{label ?? ""}
				{tooltip && (
					<InformationCircleIcon className="w-5 h-5 pt-2 text-gray-400" />
				)}
				{isRequired && <span className="text-sm text-red-600">*</span>}
			</label>
			<div className="relative rounded-md">
				<p className="pointer-events-none absolute mt-[7px] text-[15px] top-5 ml-3 h-full w-5 text-gray-600"></p>
				<div className="w-full flex justify-end pointer-events-none absolute mt-[1px] text-[15px] top-5 pr-4 h-full text-gray-600">
					{isLoading ? <Spinner type="sm" /> : icon}
				</div>
				<input
					className={twMerge(defaultClasses, className ?? "")}
					placeholder={icon ? `${placeholder ?? ""}` : placeholder}
					disabled={!!disabled || isLoading}
					value={value}
					type={type}
					onWheel={onEventBlur}
					onKeyDown={handleKeyPress}
					{...register(name as Path<T>)}
					{...rest}
				/>
				{children}
			</div>
			{errors && errors[name as keyof U] && (
				<p className="mt-2 text-sm text-red-600" id="email-error">
					{errors[name as keyof U]?.message as string}
				</p>
			)}
		</div>
	);
};

export default Input;
