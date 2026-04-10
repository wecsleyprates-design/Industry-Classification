import { type InputHTMLAttributes, useState } from "react";
import {
	type FieldErrors,
	type FieldValues,
	type Path,
	type UseFormRegister,
} from "react-hook-form";

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
	labelClassName?: string;
	/**
	 * When you want to show label* for required fields & optional is default
	 */
	isRequired?: boolean;
	children?: React.ReactNode;
	tooltip?: React.ReactNode;
}

const defaultClasses = `
block
w-full
rounded-md
border-0
py-1.5
text-gray-900
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
	labelClassName = "text-sm font-medium text-gray-900",
	tooltip,
	...rest
}: Props<T, U>) => {
	const [errorsNew, setErrors] = useState({ errors });

	const handleBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
		try {
			await validationSchema.validateAt(e.target.name, value);
			setErrors({ ...errorsNew, [e.target.name]: "" });
		} catch (error) {
			setErrors({ ...errorsNew, [e.target.name]: errorsNew });
		}
	};
	return (
		<div className="flex flex-col">
			<label htmlFor={name} className={`${labelClassName} block leading-6`}>
				{label ?? ""}
				{isRequired && <span className="text-sm text-red-600">*</span>}
			</label>
			<div className="relative rounded-md">
				<input
					className={className ?? defaultClasses}
					placeholder={placeholder}
					disabled={disabled}
					value={value}
					type={type}
					{...register(name as Path<T>)}
					{...rest}
					onBlur={handleBlur}
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
