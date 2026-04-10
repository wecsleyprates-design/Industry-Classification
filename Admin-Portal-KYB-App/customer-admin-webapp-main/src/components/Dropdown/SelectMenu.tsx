import React, { Fragment, useEffect, useState } from "react";
import { Listbox, Transition } from "@headlessui/react";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/react/20/solid";
import { type TOption } from "@/types/common";

interface CommonSelectProps {
	placeholder?: string;
	/**
	 * options should be an array of {label: string, value: string}
	 */
	options: TOption[] | [];
	value?: string | Record<string, any>;
	label: string;
	uniqueId?: string;
	onChange: (option: TOption) => void;
	isRequired?: boolean;
	error?: string;
	shortHeight?: boolean;
}

function classNames(...classes: any[]) {
	return classes.filter(Boolean).join(" ");
}

const CommonSelect: React.FC<CommonSelectProps> = ({
	options,
	placeholder,
	value,
	label,
	uniqueId,
	onChange,
	error,
	isRequired = false,
	shortHeight = false,
}) => {
	const [selected, setSelected] = useState<TOption>();

	useEffect(() => {
		if (value && options) {
			let selectedOption;
			if (typeof value === "string") {
				selectedOption = options.find((item) => item.value === value);
			} else if (uniqueId) {
				selectedOption = options.find((item) => {
					if (typeof item.value !== "string")
						return item.value?.[uniqueId] === value?.[uniqueId];
					else return false;
				});
			}
			if (selectedOption) setSelected(selectedOption);
		}
	}, [value, options]);

	const handleInputChange = (selectedOption: TOption) => {
		setSelected(selectedOption);
		// Save data on change
		onChange(selectedOption);
	};

	return (
		<Listbox value={selected} onChange={handleInputChange}>
			{({ open }) => (
				<>
					<Listbox.Label className="block text-sm font-medium leading-6 text-gray-900">
						{label}
						{isRequired && <span className="text-sm text-red-600">*</span>}
					</Listbox.Label>
					<div className="relative mt-2">
						<Listbox.Button className="relative w-full h-12 cursor-default rounded-md bg-white py-1.5 pl-3 pr-10 text-left text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6">
							<span className="block truncate">
								{selected?.label ?? placeholder}
							</span>
							<span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
								<ChevronUpDownIcon
									className="w-5 h-5 text-gray-400"
									aria-hidden="true"
								/>
							</span>
						</Listbox.Button>
						{error && !selected && (
							<p className="mt-2 text-sm text-red-600" id="email-error">
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
									"absolute z-[60] mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm",
									shortHeight && "h-28",
								)}
							>
								{options.map((option, index) => (
									<Listbox.Option
										key={index}
										className={({ active }) =>
											classNames(
												active ? "bg-indigo-600 text-white" : "text-gray-900",
												"relative cursor-default select-none py-2 pl-3 pr-9",
											)
										}
										value={option}
									>
										{({ selected, active }) => (
											<>
												<span
													className={classNames(
														selected ? "font-semibold" : "font-normal",
														"block truncate",
													)}
												>
													{option.label}
												</span>
												{selected ? (
													<span
														className={classNames(
															active ? "text-white" : "text-indigo-600",
															"absolute inset-y-0 right-0 flex items-center pr-4",
														)}
													>
														<CheckIcon className="w-5 h-5" aria-hidden="true" />
													</span>
												) : null}
											</>
										)}
									</Listbox.Option>
								))}
							</Listbox.Options>
						</Transition>
					</div>
				</>
			)}
		</Listbox>
	);
};

export default CommonSelect;
