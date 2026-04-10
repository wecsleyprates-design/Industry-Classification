import {
	type FieldErrors,
	type FieldValues,
	type Path,
	type UseFormRegister,
} from "react-hook-form";
import CheckIcon from "@/assets/CheckIcon";

type FormattedCheckboxProps<T extends FieldValues> = {
	name: Path<T>;
	register: UseFormRegister<T>;
	errors?: FieldErrors<T>;
	validationSchema?: any;
	label?: string;
	labelClassName?: string;
	disabled?: boolean;
	isRequired?: boolean;
	id?: string;
};

const FormattedCheckbox = <T extends FieldValues>({
	name,
	register,
	errors,
	validationSchema,
	label,
	labelClassName,
	disabled = false,
	isRequired = false,
	id,
}: FormattedCheckboxProps<T>) => {
	return (
		<div className="flex flex-col">
			<div className="flex items-center gap-2">
				<label
					htmlFor={id}
					className="relative flex items-center cursor-pointer gap-2"
				>
					<input
						id={id}
						type="checkbox"
						disabled={disabled}
						{...register(name, validationSchema)}
						className={`peer hidden`}
					/>
					<div
						className={`
							h-6 w-6 rounded-lg border-2 flex items-center justify-center
							cursor-pointer
							${disabled ? "bg-gray-200 cursor-not-allowed" : "bg-white"}
							${errors?.[name] ? "border-red-500" : "border-gray-300"}
							peer-checked:bg-blue-600
							peer-checked:border-blue-600
						`}
					>
						<CheckIcon />
					</div>
					{label && (
						<span
							className={`text-sm font-medium text-gray-700 font-Inter ${
								labelClassName ?? ""
							}`}
						>
							{label}
							{isRequired && (
								<span className="text-sm text-red-600 ml-1">*</span>
							)}
						</span>
					)}
				</label>
			</div>
			{errors?.[name] && (
				<p className="mt-1 text-sm text-red-600">
					{errors[name]?.message as string}
				</p>
			)}
		</div>
	);
};

export default FormattedCheckbox;
