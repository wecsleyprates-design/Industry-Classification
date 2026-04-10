import { type InputHTMLAttributes } from "react";
import {
	type FieldErrors,
	type FieldValues,
	type Path,
	type UseFormRegister,
} from "react-hook-form";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { twMerge } from "tailwind-merge";
import {
	allowsAlphanumericTaxId,
	getTaxIdInputMaxLength,
	getTaxIdMaxLength,
} from "@/lib/taxIdLabels";
import Spinner from "../Spinner";
import Tooltip from "../Tooltip/TooltipV2";

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
	className?: string;
	isRequired?: boolean;
	children?: React.ReactNode;
	icon?: React.ReactElement;
	tooltip?: string;
	isLoading?: boolean;
	errorClassName?: string;
	characterLimit?: number;
	onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
	country?: string; // for conditionall rendering based on country
}

const defaultClasses = `
block
rounded-lg
py-1.5
text-gray-900
border
ring-inset
border-[#E5E7EB]
placeholder:text-gray-400
sm:text-sm
sm:leading-6
w-full
`;

const TINInput = <T extends FieldValues, U extends FieldValues>({
	disabled = false,
	type = "text",
	placeholder,
	errors,
	label,
	name,
	register,
	className,
	children,
	isRequired = false,
	icon,
	tooltip,
	labelClassName,
	errorClassName,
	isLoading = false,
	characterLimit,
	onChange,
	country,
	...rest
}: Props<T, U>) => {
	const {
		ref,
		onChange: hookFormOnChange,
		onBlur,
		name: inputName,
	} = register(name as Path<T>);

	const stripTIN = (e: React.ChangeEvent<HTMLInputElement>) => {
		const rawValue = e.target.value;
		// If allowsAlphanumericTaxId is true, allow alphanumeric characters; otherwise, only digits
		const regex = allowsAlphanumericTaxId(country)
			? /[^a-zA-Z0-9]/g
			: /[^0-9]/g;
		let strippedValue = rawValue.replace(regex, "").trim();

		// Convert to uppercase for all non-US alphanumeric TINs
		if (allowsAlphanumericTaxId(country)) {
			strippedValue = strippedValue.toUpperCase();
		}

		// Enforce maxLength *after* stripping formatting characters.
		// This ensures that if a user pastes a formatted TIN (e.g., "123-45-6789"),
		// it becomes "123456789" and is then truncated to the clean max length (e.g., 9 chars for US).
		const maxLength = characterLimit ?? getTaxIdMaxLength(country);
		strippedValue = strippedValue.slice(0, maxLength);

		e.target.value = strippedValue;

		if (onChange) {
			onChange(e);
		}
		void hookFormOnChange({
			...e,
			target: { ...e.target, value: strippedValue },
		});
	};

	return (
		<div className="flex-col block">
			<label
				className={twMerge(
					"text-xs font-medium leading-6 text-gray-900 font-Inter",
					labelClassName,
				)}
			>
				{label ?? ""}
				{tooltip && (
					<Tooltip tooltip={tooltip}>
						<InformationCircleIcon className="w-5 h-5 pt-2 text-gray-400" />
					</Tooltip>
				)}
				{isRequired && <span className="text-sm text-red-600">*</span>}
			</label>
			<div className="relative rounded-lg">
				<p className="pointer-events-none absolute mt-[7px] text-[15px] top-5 ml-3 h-full w-5 text-gray-600"></p>
				<div className="w-full flex justify-end pointer-events-none absolute mt-[1px] text-[15px] top-5 pr-4 h-full text-gray-600">
					{isLoading ? <Spinner type="sm" /> : icon}
				</div>
				<input
					className={twMerge(defaultClasses, className ?? "")}
					placeholder={icon ? `${placeholder ?? ""}` : placeholder}
					disabled={!!disabled || isLoading}
					type={type}
					// Use buffered maxLength to allow pasting formatted TINs with dashes/spaces.
					// The actual clean length is enforced in stripTIN after removing formatting chars.
					// When characterLimit is provided, add buffer (+6) for formatting characters.
					maxLength={
						characterLimit
							? characterLimit + 6
							: getTaxIdInputMaxLength(country)
					}
					onWheel={(e) => {
						e.currentTarget.blur();
					}} // Blur on scroll
					onChange={stripTIN}
					onBlur={onBlur}
					name={inputName}
					ref={ref} // direct ref to the input element for react-hook-form
					{...rest}
				/>
				{children}
			</div>
			{errors && errors[name as keyof U] && (
				<p
					className={twMerge("mt-2 text-sm text-red-600", errorClassName)}
					id="tin-error"
				>
					{errors[name as keyof U]?.message as string}
				</p>
			)}
		</div>
	);
};

export default TINInput;
