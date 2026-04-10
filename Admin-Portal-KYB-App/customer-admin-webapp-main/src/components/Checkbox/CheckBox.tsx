import React, { type FC, useEffect } from "react";
import {
	type Control,
	Controller,
	useFieldArray,
	type UseFormClearErrors,
	type UseFormGetValues,
	type UseFormSetValue,
} from "react-hook-form";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { twMerge } from "tailwind-merge";
import { ReactCustomTooltip } from "@/components/Tooltip";
import { type Field } from "@/types/auth";
import { type ruleType } from "../../pages/Businesses/SendInvite/CustomField/InviteCustomFields";

interface Props {
	f: Field;
	control: Control<Record<string, any>, any>;
	errors: any;
	setValue: UseFormSetValue<Record<string, any>>;
	getValues: UseFormGetValues<Record<string, any>>;
	allValues: any;
	clearErrors: UseFormClearErrors<Record<string, any>>;
	register: any;
	isChecked?: boolean;
	tooltip?: string;
}

const CheckBox: FC<Props> = ({
	f,
	control,
	errors,
	setValue,
	allValues,
	clearErrors,
	register,
	isChecked,
	tooltip,
	getValues,
}) => {
	const { fields } = useFieldArray({
		control,
		name: f.internalName,
		rules: {
			required: true,
		},
	});

	useEffect(() => {
		const defaultValues = getValues(f.internalName)?.length
			? getValues(f.internalName)
			: f?.field_options?.map((option) => ({
					...option,
					checked: false,
					...(option.checkbox_type === "input" && { value: null }),
				}));

		setValue(f.internalName, defaultValues, { shouldValidate: true });
	}, [f, setValue, allValues?.new_business]);

	return (
		<>
			{/** No need to show when these conditionas met */}
			<div key={f.internalName} className="block col-span-12 md:col-span-6">
				<label className="text-xs font-medium leading-6 text-gray-900 font-Inter">
					{f.label ?? ""}
					{tooltip && (
						<ReactCustomTooltip id={f.internalName} tooltip={<>{tooltip}</>}>
							<InformationCircleIcon className="min-w-3.5 max-w-3.5 text-gray-500 mx-1" />
						</ReactCustomTooltip>
					)}
					{!!f.rules?.find((rule: ruleType) => rule?.rule === "required") && (
						<span className="text-sm text-red-600">*</span>
					)}
				</label>
				<div className="pt-2">
					{fields?.map((rowCheckbox: any, index) => {
						return (
							<div className="pb-3" key={rowCheckbox.id}>
								<Controller
									name={`${f.internalName}.${index}`} // Controls the entire object
									control={control}
									defaultValue={rowCheckbox}
									render={({ field }) => {
										const { value } = field; // The entire object (rowCheckbox)
										return (
											<>
												{rowCheckbox?.checkbox_type === "input" ? (
													<div className="my-3">
														<div className="flex">
															<input
																type="checkbox"
																checked={value.checked} // Access `checked` from the object
																onChange={(e) => {
																	const isChecked = e.target.checked;
																	setValue(
																		`${f.internalName}.${index}`,
																		{
																			...value,
																			checked: isChecked, // Update only the `checked` property
																		},
																		{ shouldValidate: true },
																	);
																	clearErrors(f.internalName); // Clear validation errors
																}}
																id={`${f.internalName}-${
																	rowCheckbox.label as string
																}`} // Unique ID for checkbox
																className="mt-5 mr-3"
															/>
															<div>
																<label
																	htmlFor={`${f.internalName}-${
																		rowCheckbox.label as string
																	}`} // Associate label with checkbox
																	className="capitalize"
																>
																	{rowCheckbox.label}
																</label>
																<div className="relative flex">
																	{rowCheckbox.icon_position === "first" && (
																		<span className="absolute left-0 flex content-center px-2 pt-6 text-center align-middle">
																			{rowCheckbox.icon}
																		</span>
																	)}
																	<input
																		type={
																			rowCheckbox.input_type === "number"
																				? "number"
																				: "text"
																		}
																		disabled={!value.checked}
																		defaultValue={value.value} // Access `value` from the object
																		onChange={(e) => {
																			const newValue = e.target.value;
																			setValue(
																				`${f.internalName}.${index}`,
																				{
																					...value,
																					value: newValue, // Update only the `value` property
																				},
																				{ shouldValidate: true },
																			);
																			clearErrors(f.internalName); // Clear validation errors
																		}}
																		id={`${f.internalName}-${
																			rowCheckbox.label as string
																		}_input`}
																		className={twMerge(
																			"block border ring-inset border-[#DFDFDF] placeholder:text-gray-400 sm:text-sm sm:leading-6 w-full rounded-md mt-2.5 font-Inter text-[15px] text-[#5E5E5E] py-2.5 px-4",
																			rowCheckbox.icon_position === "first"
																				? "px-6 mt-2"
																				: "",
																		)}
																	/>
																	{rowCheckbox.icon_position === "last" && (
																		<span className="absolute right-0 flex content-center px-2 pt-6 text-center align-middle">
																			{rowCheckbox.icon}
																		</span>
																	)}
																</div>
															</div>
														</div>
														{/* Handle and display validation errors for the array of checkboxes */}
														{errors?.[f.internalName]?.[index]?.value && (
															<p className="text-red-600">
																{errors[f.internalName][index].value.message}
															</p>
														)}
													</div>
												) : (
													<>
														<input
															type="checkbox"
															checked={value.checked} // Access `checked` from the object
															onChange={(e) => {
																const isChecked = e.target.checked;
																setValue(
																	`${f.internalName}.${index}`,
																	{
																		...value,
																		checked: isChecked, // Update the `checked` field only
																	},
																	{ shouldValidate: true },
																);
																clearErrors(f.internalName);
															}}
															id={`${f.internalName}-${
																rowCheckbox.label as string
															}`}
															className="mr-2"
														/>
														<label
															htmlFor={`${f.internalName}-${
																rowCheckbox.label as string
															}`}
															className="text-sm"
														>
															{rowCheckbox.label}
														</label>
													</>
												)}
											</>
										);
									}}
								/>
							</div>
						);
					})}
				</div>
				<p className="absolute text-sm text-red-600" id="email-error">
					{errors?.[f.internalName]?.message ?? ""}
					{errors[f.internalName]?.root?.message ?? ""}
				</p>
			</div>
		</>
	);
};

export default CheckBox;
