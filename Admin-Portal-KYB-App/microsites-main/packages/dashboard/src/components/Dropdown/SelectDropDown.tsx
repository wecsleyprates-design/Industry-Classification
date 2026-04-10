import React, { Fragment, useEffect, useState } from "react";
import { Listbox, Transition } from "@headlessui/react";
import { CheckIcon, ChevronDoubleDownIcon } from "@heroicons/react/20/solid";
import classNames from "classnames";
import { type TOption } from "@/lib/types/common";

interface CommonSelectProps {
	placeholder?: string;
	/**
	 * options should be an array of {label: string, value: string}
	 */
	options: TOption[] | [];
	value?: string | Record<string, any>;
	label?: string;
	uniqueId?: string;
	onChange: (option: TOption) => void;
	isRequired?: boolean;
	error?: string;
	reset?: boolean;
}

const SelectDropDown: React.FC<CommonSelectProps> = ({
	options,
	placeholder,
	value,
	label,
	uniqueId,
	onChange,
	isRequired = false,
	error,
	reset,
}) => {
	const [selected, setSelected] = useState<TOption>();

	const handleInputChange = (selectedOption: TOption) => {
		setSelected(selectedOption);
		// Save data on change
		onChange(selectedOption);
	};

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

	useEffect(() => {
		if (reset) {
			setSelected({ label: placeholder ?? "", value: "" });
		}
	}, [reset]);

	return (
		<Listbox value={selected} onChange={handleInputChange}>
			{({ open }) => (
				<>
					<Listbox.Label className="block text-sm font-medium leading-6 text-gray-900">
						{label}
						{isRequired && <span className="text-sm text-red-600">*</span>}
					</Listbox.Label>
					<div className="relative mt-1">
						<Listbox.Button className="relative w-full pr-3 text-right text-gray-900 rounded-md cursor-default ring-0 ring-inset ring-white">
							<span className="block truncate">
								{selected?.label ?? placeholder}
							</span>
							<span className="absolute inset-y-0 right-0 flex items-center pointer-events-none">
								<ChevronDoubleDownIcon />
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
							<Listbox.Options className="absolute z-10 mt-1 max-h-60 w-[100px] overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
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
															"absolute inset-y-0 right-0 flex items-center pr-1",
														)}
													>
														<CheckIcon className="w-3 h-3" aria-hidden="true" />
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

export default SelectDropDown;
