import { type InputHTMLAttributes, type KeyboardEvent } from "react";
import { useState } from "react";
import {
	type FieldErrors,
	type FieldValues,
	type Path,
	type UseFormRegister,
} from "react-hook-form";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import cx from "classnames";
import { twMerge } from "tailwind-merge";
import Spinner from "@/components/Spinner";
import { ReactCustomTooltip } from "@/components/Tooltip";
import { DefaultInputClasses } from "./DefaultInputClasses";

export interface Props<
	T extends FieldValues = FieldValues,
	U extends FieldValues = FieldValues,
> extends InputHTMLAttributes<HTMLInputElement> {
	name: string;
	label?: string;
	labelClassName?: string;
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
	errorClassName?: string;
}

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
	labelClassName,
	errorClassName,
	isLoading = false,
	...rest
}: Props<T, U>) => {
	const [fieldValue, setFieldValue] = useState("");
	return (
		<div className="flex-col block ">
			<label
				className={twMerge(
					"text-xs font-medium leading-6 text-gray-900 font-Inter",
					labelClassName,
				)}
			>
				{label ?? ""}
				{tooltip && (
					<ReactCustomTooltip id={name} tooltip={<>{tooltip}</>}>
						<InformationCircleIcon className="min-w-3.5 max-w-3.5 text-gray-500 mx-1" />
					</ReactCustomTooltip>
				)}
				{isRequired && <span className="text-sm text-red-600">*</span>}
			</label>
			<div className="relative rounded-lg">
				<p className="pointer-events-none absolute mt-[7px] text-[15px] top-5 ml-3 h-full w-5 text-gray-600"></p>
				<div className="w-full flex justify-end pointer-events-none absolute mt-[1px] text-[15px] top-5 pr-4 h-full text-gray-600">
					{isLoading ? <Spinner type="sm" /> : icon}
				</div>
				<input
					className={cx(
						className,
						DefaultInputClasses ?? "",
						!fieldValue && "border-radius 8px border-[#E5E7EB]",
					)}
					placeholder={icon ? `${placeholder ?? ""}` : placeholder}
					disabled={!!disabled || isLoading}
					value={value}
					type={type}
					onWheel={onEventBlur}
					onKeyDown={handleKeyPress}
					{...register(name as Path<T>, {
						onChange: (e) => {
							setFieldValue(e.target.value);
						},
					})}
					{...rest}
				/>
				{children}
			</div>
			{errors && errors[name as keyof U] && (
				<p
					className={twMerge("mt-2 text-sm text-red-600", errorClassName)}
					id="email-error"
				>
					{errors[name as keyof U]?.message as string}
				</p>
			)}
		</div>
	);
};

export default Input;
