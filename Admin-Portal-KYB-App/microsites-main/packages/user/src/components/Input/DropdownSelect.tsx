import { type FC, Fragment, useMemo } from "react";
import { Listbox, Transition } from "@headlessui/react";
import { ChevronDownIcon, ChevronUpIcon } from "@radix-ui/react-icons";
import { type TOption } from "@/types/common";

interface DropdownSelectProps {
	placeholder?: string;
	/**
	 * options should be an array of {label: string, value: string}
	 */
	options: TOption[] | [];
	/**
	 * Controlled value - can be a TOption object, string, or Record for backward compatibility
	 * When used with react-hook-form Controller, pass the field.value directly
	 */
	value?: TOption | string | Record<string, any> | null;
	label: string;
	uniqueId?: string;
	name: string;
	onChange: (option: TOption) => void;
	isRequired?: boolean;
	error?: string;
	shortHeight?: boolean;
	disabled?: boolean;
}

function classNames(...classes: any[]) {
	return classes.filter(Boolean).join(" ");
}

const DropdownSelect: FC<DropdownSelectProps> = ({
	options,
	placeholder,
	value,
	label,
	uniqueId,
	onChange,
	error,
	isRequired = false,
	shortHeight = false,
	disabled = false,
}) => {
	const normalizedValue = value ?? null;

	const selected = useMemo(() => {
		if (!normalizedValue) return null;

		// If value is already a TOption (has both label and value), use it directly
		if (
			typeof normalizedValue === "object" &&
			"label" in normalizedValue &&
			"value" in normalizedValue
		) {
			return normalizedValue as TOption;
		}

		// If value is a string, match by option.value
		if (typeof normalizedValue === "string") {
			return options.find((item) => item.value === normalizedValue) ?? null;
		}

		// If value is an object, try to match it with an option
		if (typeof normalizedValue === "object") {
			// Match by id if both have it
			if ("id" in normalizedValue) {
				const matched = options.find((item) => {
					const itemWithId = item as TOption & { id?: unknown };
					return "id" in itemWithId && itemWithId.id === normalizedValue.id;
				});
				if (matched) return matched;
			}

			if (
				"code" in normalizedValue &&
				typeof normalizedValue.code === "string"
			) {
				return (
					options.find((item) => item.value === normalizedValue.code) ?? null
				);
			}

			if (uniqueId) {
				return (
					options.find((item) => {
						if (typeof item.value !== "string") {
							return item.value?.[uniqueId] === normalizedValue?.[uniqueId];
						}
						return false;
					}) ?? null
				);
			}
		}

		return null;
	}, [normalizedValue, options, uniqueId]);

	const handleInputChange = (selectedOption: TOption) => {
		onChange(selectedOption);
	};

	return (
		<Listbox
			value={selected ?? undefined}
			onChange={handleInputChange}
			disabled={disabled}
		>
			{({ open }) => (
				<div>
					<Listbox.Label className="block text-sm font-normal leading-6 text-gray-800">
						{label}
						{isRequired && <span className="text-sm text-red-600">*</span>}
					</Listbox.Label>
					<div className="relative">
						<Listbox.Button
							className={classNames(
								"relative w-full h-[44px] rounded-md py-1.5 pl-3 pr-10 text-left text-gray-900 sm:text-sm sm:leading-6 border border-[#DFDFDF]",
								disabled
									? "bg-gray-50 cursor-not-allowed"
									: "bg-white cursor-default",
							)}
						>
							<span className="block truncate font-normal">
								{selected?.label ?? placeholder}
							</span>
							<span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
								{open ? (
									<ChevronUpIcon className="w-5 h-5 text-gray-500 mr-2" />
								) : (
									<ChevronDownIcon className="w-5 h-5 text-gray-500 mr-2" />
								)}
							</span>
						</Listbox.Button>
						{error && (
							<p className="mt-2 text-sm text-red-600" id={`${name}-error`}>
								{error}
							</p>
						)}
						<Transition
							show={open}
							as={Fragment}
							leave="transition ease-in duration-100"
							leaveFrom="opacity-100"
							leaveTo="opacity-0"
						>
							<Listbox.Options
								className={classNames(
									"absolute mt-1 max-h-32 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg border border-gray-200 focus:outline-none sm:text-sm",
									shortHeight && "h-28",
								)}
							>
								{options.map((option, index) => (
									<Listbox.Option
										key={index}
										className={({ active, selected }) =>
											classNames(
												active || selected
													? "bg-gray-100 text-gray-900"
													: "text-gray-900",
												"relative cursor-default select-none py-2 pl-3 pr-9 mx-2 rounded-lg",
											)
										}
										value={option}
									>
										{({ selected, active }) => (
											<>
												<div className="flex flex-col">
													<span
														className={classNames(
															"font-semibold",
															"block truncate",
														)}
													>
														{option.label}
													</span>
													{typeof option.description === "string" && (
														<span className="text-sm text-gray-500 block truncate mt-0.5">
															{option.description}
														</span>
													)}
												</div>
											</>
										)}
									</Listbox.Option>
								))}
							</Listbox.Options>
						</Transition>
					</div>
				</div>
			)}
		</Listbox>
	);
};

export default DropdownSelect;
