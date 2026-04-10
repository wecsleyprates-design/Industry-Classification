import React, { Fragment, useEffect, useState } from "react";
import { Listbox, Transition } from "@headlessui/react";
import { CheckIcon, ChevronDownIcon } from "@heroicons/react/20/solid";
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
	/**
	 * @description uniqueId is used when values are object containing a unique key
	 */
	uniqueId?: string;
	onChange: (option: TOption) => void;
	isRequired?: boolean;
	error?: string;
	reset?: boolean;
}

const CommonSelect: React.FC<CommonSelectProps> = ({
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
		onChange(selectedOption);
	};

	useEffect(() => {
		if (value && options) {
			let selectedOption;
			if (typeof value === "string") {
				selectedOption = options.find((item) => item.value === value);
			} else if (uniqueId) {
				selectedOption = options.find((item) => {
					// when you don't have specific key as unique but the object is unique
					// TODO: compare using JSON.stringify
					if (uniqueId === "value") {
						if (item.value === value.value) return true;
						else return false;
					}
					// when you have value as a object
					if (typeof item.value !== "string") {
						return item.value?.[uniqueId] === value?.[uniqueId];
					} else return false;
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
					<Listbox.Label className="block text-xs font-medium leading-6 text-gray-900">
						{label}
						{isRequired && <span className="text-sm text-red-600">*</span>}
					</Listbox.Label>
					<div className="relative mt-2.5 h-11">
						<Listbox.Button className="relative w-full h-full cursor-default rounded-md bg-white pl-3 pr-10 text-left text-gray-900 shadow-sm border border-[#DFDFDF] focus:outline-none focus:ring-2 focus:ring-black sm:text-sm sm:leading-6">
							<span className="block truncate">
								{selected?.label ?? placeholder}
							</span>
							<span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
								<ChevronDownIcon
									className="h-5 w-5 text-gray-400"
									aria-hidden="true"
								/>
							</span>
						</Listbox.Button>
						{error && !selected && (
							<p className="text-sm text-red-600" id="email-error">
								{error !== "undefined" && error}
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
								className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm"
								style={{ maxHeight: "190px" }}
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
														"block break-words",
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
														<CheckIcon className="h-5 w-5" aria-hidden="true" />
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
