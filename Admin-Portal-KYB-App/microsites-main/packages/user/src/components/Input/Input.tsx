import {
	type FocusEvent,
	type InputHTMLAttributes,
	type ReactElement,
	type ReactNode,
	useState,
} from "react";
import {
	type FieldErrors,
	type FieldValues,
	type Path,
	type UseFormRegister,
} from "react-hook-form";
import { twMerge } from "tailwind-merge";
import { cn } from "@/lib/utils";

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
	children?: ReactNode;
	isRequired?: boolean;
	icon?: ReactElement;
	labelClassName?: string;
	iconClass?: string;
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
px-2
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
	iconClass,
	labelClassName = "text-sm font-medium text-gray-900",
	...rest
}: Props<T, U>) => {
	const [errorsNew, setErrors] = useState({ errors });

	const handleBlur = async (e: FocusEvent<HTMLInputElement>) => {
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
				<>
					{label}
					{isRequired && <span className="text-sm text-red-600">*</span>}
				</>
			</label>
			<div className="relative flex flex-1 rounded-md">
				<span
					className={cn(
						"absolute w-5 h-full ml-3 text-gray-600  top-5",
						iconClass,
					)}
				>
					{icon}
				</span>
				<input
					value={value}
					className={twMerge(defaultClasses, className)}
					placeholder={icon ? `  ${placeholder ?? ""}` : placeholder}
					disabled={!!disabled}
					type={type}
					{...register(name as Path<T>)}
					{...rest}
					onBlur={handleBlur}
				/>
				{children}
			</div>
			{errors && errors[name as keyof U] && (
				<p className="mt-2 text-sm text-red-600" id={`${name}-error`}>
					{errors[name as keyof U]?.message as string}
				</p>
			)}
		</div>
	);
};

export default Input;
