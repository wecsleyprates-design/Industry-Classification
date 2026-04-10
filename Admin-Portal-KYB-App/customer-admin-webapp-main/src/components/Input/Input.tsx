import { type InputHTMLAttributes, useState } from "react";
import {
	type FieldErrors,
	type FieldValues,
	type Path,
	type UseFormRegister,
} from "react-hook-form";
import { twMerge } from "tailwind-merge";

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
	children?: React.ReactNode;
	isRequired?: boolean;
	icon?: React.ReactElement;
	labelClassName?: string;
	tooltip?: React.ReactNode;
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
	labelClassName = "text-sm font-medium text-gray-900",
	tooltip,
	onFocus,
	onBlur,
	onChange,
	...rest
}: Props<T, U>) => {
	const [errorsNew, setErrors] = useState({ errors });
	const registerProps = register(name as Path<T>);

	const handleBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
		try {
			await validationSchema.validateAt(e.target.name, value);
			setErrors({ ...errorsNew, [e.target.name]: "" });
		} catch (error) {
			setErrors({ ...errorsNew, [e.target.name]: errorsNew });
		}
		onBlur?.(e);
	};

	const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
		onFocus?.(e);
	};

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		onChange?.(e);
		void registerProps.onChange(e);
	};

	return (
		<div className="flex flex-col">
			<div className="flex items-center gap-x-1">
				<label htmlFor={name} className={`${labelClassName} block leading-6`}>
					<>
						{label}
						{isRequired && <span className="text-sm text-red-600">*</span>}
					</>
				</label>
				{tooltip && tooltip}
			</div>
			<div className="relative flex flex-1 rounded-md">
				<span className="absolute w-5 h-full ml-3 text-gray-600 pointer-events-none top-5">
					{icon}
				</span>
				<input
					value={value}
					className={twMerge(defaultClasses, className)}
					placeholder={icon ? `  ${placeholder ?? ""}` : placeholder}
					disabled={!!disabled}
					type={type}
					{...registerProps}
					{...rest}
					onBlur={handleBlur}
					onFocus={handleFocus}
					onChange={handleChange}
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
