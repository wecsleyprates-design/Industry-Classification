import { useEffect, useState } from "react";
import { Controller, useFormContext } from "react-hook-form";
import DatePicker from "react-multi-date-picker";
import Select from "react-select";
import {
	InformationCircleIcon,
	XCircleIcon,
} from "@heroicons/react/24/outline";
import { twMerge } from "tailwind-merge";
import { OnboardingFlowDropdownStyles } from "@/assets/OnboardingFlowDropdownStyles";
import CheckBox from "@/components/Checkbox/CheckBox";
import Input from "@/components/Input/ControlledInput";
import { DefaultInputClasses } from "@/components/Input/DefaultInputClasses";
import PhoneNumber from "@/components/PhoneNumber/PhoneNumber";
import TextArea from "@/components/TextArea/ControlledTextArea";
import { ReactCustomTooltip } from "@/components/Tooltip";
import Uploader from "@/components/Uploader/Uploader";
import { evaluateCondition } from "@/lib/expression";
import { todayEnd, toMDY } from "@/lib/utils/dateUtil";
import { type Field, type PreFilledData } from "@/types/auth";
import ConditionalVisibility from "./ConditionalVisibility";
import { parse } from "./utils";

type DynamicObject = Record<string, []>;
export type ruleType = {
	rule: any;
};
export type inputProperty = {
	description: any;
	property: any;
	internalName: string;
	label: string;
	value: any;
	rules: any;
	is_sensitive_info: any;
	field_options: any;
	step_name: string;
	values: any;
	id: string;
	section_name: string;
	value_id: string[];
};
export const CustomInputType = {
	text: "string",
	full_text: "string",
	integer: "number",
	NUMBER: "number",
	DROPDOWN: "object",
	UPLOAD: "mixed",
	decimal: "number",
	date: "date",
};

// typing for switch
const Types = {
	text: "text",
	full_text: "full_text",
	email: "email",
	integer: "integer",
	dropdown: "dropdown",
	boolean: "boolean",
	upload: "upload",
	phoneNumber: "phone_number",
	alphanumeric: "alphanumeric",
	decimal: "decimal",
	checkbox: "checkbox",
	date: "date",
};
interface CustomFieldProps {
	customFieldsdata?: PreFilledData | null;
	showCustomFields?: boolean;
}

export const checkIfVisibleField = (
	field: Field,
	values: any,
	fields: Field[],
) => {
	let showField;
	const fieldVisibility = field?.rules?.find(
		(rule: any) => rule?.rule === "field_visibility",
	);
	if (fieldVisibility) {
		// reverse visibile conditioin applied component logas
		showField = !(fieldVisibility?.condition?.visibility === "TRUE");

		// creating object for template
		const keys = fieldVisibility?.condition?.fields ?? [];
		const types = fields
			?.filter((val) => {
				return keys?.find((key: string) => key === val.internalName);
			})
			.map((item) => ({
				key: item.internalName,
				property: item.property,
			}));
		const res = types?.reduce((acc: any, item) => {
			if (item.property === "dropdown") {
				acc[item.key] = values?.[item.key]?.label?.trim() ?? "";
			} else if (item.property === "boolean") {
				acc[item.key] = !!(values?.[item.key] && parse(values?.[item.key]));
			} else if (item.property === "checkbox") {
				const inputValue = values?.[item.key];
				if (fieldVisibility?.condition?.fields?.includes(item.key)) {
					if (typeof inputValue === "object") {
						const inputName =
							fieldVisibility?.condition?.dependency?.split("=")[1];
						const fieldArrray =
							typeof values?.[item.key]?.map((val: any) => val?.label) !==
							"object"
								? values?.[item.key]?.map((val: any) => ({
										label: val?.label,
										checked: val?.checked,
									})) === undefined
									? []
									: (parse(
											values?.[item.key]?.map((val: any) => ({
												label: val?.label,
												checked: val?.checked,
											})) ?? [],
										) ?? [])
								: (values?.[item.key]?.map((val: any) => ({
										label: val?.label,
										checked: val?.checked,
									})) ?? []);

						const currentField = fieldArrray?.find(
							(val: any) => val?.label?.trim() === inputName?.trim(),
						);
						if (currentField?.checked) {
							acc[item.key] = inputName?.trim();
						}
					}
				}
			} else if (item.property === "date") {
				acc[item.key] = toMDY(values?.[item.key] as string) ?? "";
			} else {
				acc[item.key] = values?.[item.key] ?? "";
			}
			return acc;
		}, {});
		//  apply visibility only when template satisfies given condition
		if (
			res &&
			evaluateCondition(fieldVisibility?.condition?.dependency ?? "", res)
		) {
			showField = fieldVisibility?.condition?.visibility === "TRUE";
		}
	} else {
		return true;
	}
	return showField;
};

const CustomFields: React.FC<CustomFieldProps> = ({
	customFieldsdata,
	showCustomFields,
}) => {
	const [fieldObjectState, setFieldObject] = useState<any>({});

	const [Stepfields, setFields] = useState<DynamicObject>({});

	// const isFieldsLoading = useMemo(() => {
	// 	if (JSON.stringify(Stepfields) === "{}") {
	// 		return true;
	// 	}

	// 	return false;
	// }, [Stepfields]);

	const {
		register,
		control,
		setValue,
		getValues,
		clearErrors,
		watch,
		reset,
		trigger,
		formState: { errors },
	} = useFormContext();

	const formatDateValue = (input?: string | null) => {
		if (!input) return "";
		return toMDY(input) ?? input;
	};

	useEffect(() => {
		const GroupFields: any = {};
		const fieldObject: any = {};
		customFieldsdata?.fields?.forEach((field) => {
			const defaultValue: any = field?.rules?.filter(
				(rule: any) => rule.rule === "default",
			);
			// if values present then update reset object
			if (field?.value) {
				if (field?.property === "dropdown") {
					fieldObject[field.internalName] =
						(typeof field?.value === "string" && parse(field?.value)) ?? null;
				} else if (field?.property === "boolean") {
					fieldObject[field.internalName] =
						field?.value === "true"
							? true
							: field?.value === "false"
								? false
								: defaultValue?.[0]?.value === "TRUE"
									? true
									: defaultValue?.[0]?.value === "FALSE"
										? false
										: null;
				} else if (field.property === "upload") {
					// Handle the "upload" field type logic
					const maxNumFiles =
						field.rules?.find((rule: any) => rule.rule === "maxNumFiles")
							?.value ?? 1;

					// Create an array to hold file details (fileName and value_id)
					const newFileObject = [];

					// Ensure the length matches maxNumFiles
					if (field?.value && field?.value_id) {
						const valueFiles = field?.value;
						const valueIds = field?.value_id;

						// Sync file names and ids
						for (let i = 0; i < maxNumFiles; i++) {
							if (valueFiles[i] && valueIds[i]) {
								newFileObject.push({
									fileName: valueFiles[i],
									value_id: valueIds[i],
								});
							} else {
								// Add empty placeholders if there are not enough files
								newFileObject.push({ fileName: null, value_id: null });
							}
						}
					}
					fieldObject[field.internalName] = newFileObject; // Assign the new file object to the field
				} else if (field.property === "date") {
					fieldObject[field.internalName] = toMDY(field.value as string) ?? "";
				} else {
					fieldObject[field.internalName] = field?.value ?? "";
				}
			} else if (defaultValue[0]?.value) {
				if (field.property === "dropdown") {
					const fieldOptions = field.field_options.filter(
						(option) => option.value === defaultValue[0]?.value,
					);
					field.value = JSON.stringify(fieldOptions[0]);
				} else if (field.property === "checkbox") {
					const tmpValue: any = [];
					const defaultValues: any = defaultValue[0]?.value.split(",");
					let defauldValueIndex = 0;
					field.field_options.forEach((option: any) => {
						if (option.checkbox_type === "input") {
							if (defaultValues.length > defauldValueIndex) {
								option.checked = true;
								option.value = Number(defaultValues[defauldValueIndex]);
								tmpValue.push(option);
							} else {
								option.checked = false;
								tmpValue.push(option);
							}
							defauldValueIndex++;
						} else {
							if (defaultValues.indexOf(option.value) !== -1) {
								option.checked = true;
								tmpValue.push(option);
							} else {
								option.checked = false;
								tmpValue.push(option);
							}
						}
					});
					field.value = JSON.stringify(tmpValue);
				} else {
					field.value = defaultValue[0]?.value;
				}
			} else if (field?.property === "upload") {
				const maxNumFiles =
					field.rules?.find((rule: any) => rule.rule === "maxNumFiles")
						?.value ?? 1;

				const newFileObject = [];

				while (newFileObject.length < maxNumFiles) {
					newFileObject.push({ fileName: null, value_id: null });
				}

				fieldObject[field.internalName] = newFileObject; // Assign the new file object to the field
			}

			const description: any = field?.rules?.filter(
				(rule: any) => rule.rule === "description",
			);
			field.description = description[0]?.value ? description[0]?.value : null;

			if (GroupFields[field?.step_name]) {
				GroupFields[field?.step_name].push(field);
			} else {
				GroupFields[field?.step_name] = [];
				GroupFields[field?.step_name].push(field);
			}
		});
		if (
			Object.keys(fieldObject).length > 0 &&
			JSON.stringify(fieldObject) !== JSON.stringify(fieldObjectState)
		) {
			// resetting form on page load or reset
			// reset() replaces the whole form state, so we need to pass default values
			// to avoid unintentionally wiping them out on page load
			reset({
				...getValues(),
				...fieldObject,
			});
			setFieldObject(fieldObject);
		}
		if (JSON.stringify(GroupFields) !== JSON.stringify(Stepfields))
			setFields(GroupFields);
	}, [customFieldsdata]);

	const checkIfRequired = (fields: Field[], field: Field) => {
		const formValues = watch();
		const isRequired = field.rules?.some(
			(rule: ruleType) => rule.rule === "required",
		);
		const fieldVisibility = field.rules?.find(
			(rule: ruleType) => rule.rule === "field_visibility",
		);

		if (fieldVisibility) {
			const keys = fieldVisibility?.condition?.fields ?? [];
			const types = fields
				?.filter((val) => keys?.includes(val.internalName))
				.map((item) => ({
					key: item.internalName,
					property: item.property,
				}));

			const res = types?.reduce((acc: any, item) => {
				if (item.property === "dropdown") {
					acc[item.key] = formValues?.[item.key]?.label?.trim() ?? "";
				} else if (item.property === "boolean") {
					acc[item.key] = !!(
						formValues?.[item.key] && parse(formValues?.[item.key])
					);
				} else if (item.property === "checkbox") {
					const inputValue = formValues?.[item.key];
					if (fieldVisibility?.condition?.fields?.includes(item.key)) {
						if (typeof inputValue === "object") {
							const inputName =
								fieldVisibility?.condition?.dependency?.split("=")[1];
							const fieldArrray =
								typeof formValues?.[item.key]?.map((val: any) => val?.label) !==
								"object"
									? formValues?.[item.key]?.map((val: any) => ({
											label: val?.label,
											checked: val?.checked,
										})) === undefined
										? []
										: (parse(
												formValues?.[item.key]?.map((val: any) => ({
													label: val?.label,
													checked: val?.checked,
												})),
											) ?? [])
									: (formValues?.[item.key]?.map((val: any) => ({
											label: val?.label,
											checked: val?.checked,
										})) ?? []);
							const currentField = fieldArrray?.find(
								(val: any) => val?.label?.trim() === inputName?.trim(),
							);
							if (currentField?.checked) {
								acc[item.key] = inputName?.trim();
							}
						}
					}
				} else if (item.property === "date") {
					acc[item.key] = toMDY(formValues?.[item.key] as string) ?? "";
				} else {
					acc[item.key] = formValues?.[item.key] ?? "";
				}
				return acc;
			}, {});

			if (
				evaluateCondition(fieldVisibility?.condition?.dependency ?? "", res) &&
				fieldVisibility?.condition?.visibility === "TRUE"
			) {
				return isRequired;
			}
		}

		return isRequired;
	};

	return (
		<>
			{/* {isFieldsLoading ? (
				<FullPageLoader />
			) : ( */}
			<div className="w-full">
				<div className="mb-5">
					<div className="text-base font-semibold text-black font-Inter">
						Custom Fields
					</div>
					<p className="text-sm text-gray-500">
						Please fill in any applicable fields before sending the invite.
					</p>
				</div>
				{customFieldsdata && showCustomFields && (
					<>
						{Object.keys(Stepfields).map((stepName: string, index: number) => {
							/*
												Conditional logic for showing headers
												If all fields are hidden then don't need to show header
											*/
							const values = watch();
							const res = Stepfields[stepName].map((field: Field) => {
								return checkIfVisibleField(
									field,
									values,
									customFieldsdata?.fields,
								);
							});
							const shouldHide = res.every((a) => !a);
							return (
								<div key={index}>
									{shouldHide ? null : stepName ? (
										<div
											className={twMerge(
												"flex items-center justify-start w-full mt-3 mb-1",
												index > 0 ? "mt-6" : "",
											)}
										>
											<div
												className="text-sm font-semibold text-black font-Inter"
												key={stepName}
											>
												{stepName}
											</div>
										</div>
									) : (
										""
									)}
									<div className="grid w-full grid-cols-1 md:grid-cols-12 sm:gap-x-4 gap-y-4 lg:gap-x-16">
										{Stepfields[stepName]?.map((f: inputProperty) => {
											switch (f.property) {
												case Types.text:
													return (
														<ConditionalVisibility
															key={f.internalName}
															field={f}
															formValues={watch() ?? getValues()}
															setValue={setValue}
															fields={customFieldsdata.fields ?? []}
														>
															<div
																key={f.internalName}
																className="block col-span-12 md:col-span-6"
															>
																<Input
																	key={f.internalName}
																	label={f.label}
																	tooltip={f.description}
																	type={
																		f.property === "email" ? f.property : "text"
																	}
																	placeholder={`Enter ${f.label}`}
																	register={register}
																	name={f.internalName}
																	defaultValue={f.value}
																	isRequired={checkIfRequired(
																		customFieldsdata.fields ?? [],
																		f,
																	)}
																	errors={errors}
																	className={twMerge(
																		"w-full rounded-md mt-2.5 font-Inter text-[15px] text-[#5E5E5E] py-2.5 px-4",
																		f.is_sensitive_info
																			? "masked-password"
																			: "",
																	)}
																/>
															</div>
														</ConditionalVisibility>
													);
												case Types.full_text:
													return (
														<ConditionalVisibility
															key={f.internalName}
															field={f}
															formValues={watch() ?? getValues()}
															setValue={setValue}
															fields={customFieldsdata.fields ?? []}
														>
															<div
																key={f.internalName}
																className="block col-span-12 md:col-span-12"
															>
																<TextArea
																	key={f.internalName}
																	id={f.internalName}
																	label={f.label}
																	tooltip={f.description}
																	type={"text"}
																	control={control}
																	placeholder={`Enter ${f.label}`}
																	register={register}
																	name={f.internalName}
																	defaultValue={f.value}
																	errors={errors}
																	isRequired={checkIfRequired(
																		customFieldsdata.fields ?? [],
																		f,
																	)}
																	className={twMerge(
																		"w-full rounded-md mt-2.5 font-Inter text-[15px] text-[#5E5E5E] py-2.5 px-4",
																		f.is_sensitive_info
																			? "masked-password"
																			: "",
																	)}
																/>
															</div>
														</ConditionalVisibility>
													);
												case Types.email:
													return (
														<ConditionalVisibility
															key={f.internalName}
															field={f}
															formValues={watch() ?? getValues()}
															setValue={setValue}
															fields={customFieldsdata.fields ?? []}
														>
															<div
																key={f.internalName}
																className="block col-span-12 md:col-span-6"
															>
																<Input
																	key={f.internalName}
																	label={f.label}
																	type={"email"}
																	placeholder={`Enter ${f.label}`}
																	defaultValue={f.value}
																	tooltip={f.description}
																	register={register}
																	isRequired={checkIfRequired(
																		customFieldsdata.fields ?? [],
																		f,
																	)}
																	name={f.internalName}
																	errors={errors}
																	className={twMerge(
																		"w-full rounded-md mt-2.5 font-Inter text-[15px] text-[#5E5E5E] py-2.5 px-4",
																		f.is_sensitive_info
																			? "masked-password"
																			: "",
																	)}
																/>
															</div>
														</ConditionalVisibility>
													);
												case Types.alphanumeric:
													return (
														<ConditionalVisibility
															key={f.internalName}
															field={f}
															formValues={watch() ?? getValues()}
															setValue={setValue}
															fields={customFieldsdata.fields ?? []}
														>
															<div
																key={f.internalName}
																className="block col-span-12 md:col-span-6"
															>
																<Input
																	key={f.internalName}
																	label={f.label}
																	placeholder={`Enter ${f.label}`}
																	register={register}
																	tooltip={f.description}
																	name={f.internalName}
																	defaultValue={f.value}
																	errors={errors}
																	isRequired={checkIfRequired(
																		customFieldsdata.fields ?? [],
																		f,
																	)}
																	className={twMerge(
																		"w-full rounded-md mt-2.5 font-Inter text-[15px] text-[#5E5E5E] py-2.5 px-4",
																		f.is_sensitive_info
																			? "masked-password"
																			: "",
																	)}
																/>
															</div>
														</ConditionalVisibility>
													);
												case Types.integer:
													return (
														<ConditionalVisibility
															key={f.internalName}
															field={f}
															formValues={watch() ?? getValues()}
															setValue={setValue}
															fields={customFieldsdata.fields ?? []}
														>
															<div
																key={f.internalName}
																className="block col-span-12 md:col-span-6"
															>
																<Input
																	label={f.label}
																	type="text"
																	placeholder={`Enter ${f.label}`}
																	register={register}
																	tooltip={f.description}
																	defaultValue={f.value}
																	name={f.internalName}
																	errors={errors}
																	isRequired={checkIfRequired(
																		customFieldsdata.fields ?? [],
																		f,
																	)}
																	onChange={(e) => {
																		let value = e.target.value;
																		value = value.replace(/[^0-9.]/g, "");
																		const decimalCount = (
																			value.match(/\./g) ?? []
																		).length;
																		if (decimalCount > 1) {
																			value = value.replace(/\.(?=.*\.)/g, "");
																		}
																		e.target.value = value;
																		setValue(f.internalName, value, {
																			shouldValidate: true,
																		});
																	}}
																	className={twMerge(
																		"w-full rounded-md mt-2.5 font-Inter text-[15px] text-[#5E5E5E] py-2.5 px-4",
																		f.is_sensitive_info
																			? "masked-password"
																			: "",
																	)}
																/>
															</div>
														</ConditionalVisibility>
													);
												case Types.dropdown:
													return (
														<ConditionalVisibility
															key={f.internalName}
															field={f}
															formValues={watch() ?? getValues()}
															setValue={setValue}
															fields={customFieldsdata.fields ?? []}
														>
															<div
																key={f.internalName}
																className="block col-span-12 md:col-span-6"
															>
																<label className="text-xs font-medium leading-6 text-gray-900 font-Inter">
																	{f.label ?? ""}
																	{f.description && (
																		<ReactCustomTooltip
																			id={f.internalName}
																			tooltip={<>{f.description}</>}
																		>
																			<InformationCircleIcon className="min-w-3.5 max-w-3.5 text-gray-500 mx-1" />
																		</ReactCustomTooltip>
																	)}
																	{checkIfRequired(
																		customFieldsdata.fields ?? [],
																		f,
																	) && (
																		<span className="text-sm text-red-600">
																			*
																		</span>
																	)}
																</label>
																<div className="mt-2.5 z-0">
																	<Controller
																		name={f.internalName}
																		control={control}
																		defaultValue={parse(f.value)}
																		render={({ field }) => (
																			<Select
																				{...field}
																				maxMenuHeight={180}
																				styles={OnboardingFlowDropdownStyles}
																				options={f.field_options.map(
																					(item: any) => ({
																						value: item.value,
																						label: item.label,
																					}),
																				)}
																				onChange={(e: any) => {
																					setValue(f.internalName, e, {
																						shouldValidate: true,
																					});
																					clearErrors(f.internalName);
																				}}
																				components={{
																					IndicatorSeparator: () => null,
																				}}
																				placeholder={"Select"}
																				closeMenuOnSelect={true}
																				value={getValues()[f.internalName]}
																			/>
																		)}
																	/>
																</div>
																<p
																	className="absolute text-sm text-red-600"
																	id="email-error"
																>
																	{errors?.[f.internalName] &&
																		String(errors?.[f.internalName]?.message)}
																</p>
															</div>
														</ConditionalVisibility>
													);
												case Types.checkbox:
													return (
														<ConditionalVisibility
															key={f.internalName}
															field={f}
															formValues={watch() ?? getValues()}
															setValue={setValue}
															fields={customFieldsdata.fields ?? []}
														>
															<CheckBox
																key={JSON.stringify(f)}
																f={f}
																tooltip={f.description}
																control={control}
																errors={errors}
																setValue={setValue}
																getValues={getValues}
																allValues={watch()}
																clearErrors={clearErrors}
																register={register}
															/>
														</ConditionalVisibility>
													);
												case Types.boolean:
													return (
														<ConditionalVisibility
															key={f.internalName}
															field={f}
															formValues={watch() ?? getValues()}
															setValue={setValue}
															fields={customFieldsdata.fields ?? []}
														>
															<div
																key={f.internalName}
																className="block col-span-12"
															>
																<div className="mt-2.5">
																	<Controller
																		name={f.internalName}
																		control={control}
																		defaultValue={f.value ?? null}
																		render={({ field }) => (
																			<div className="flex break-all items-top">
																				<input
																					{...field}
																					type="checkbox"
																					checked={field?.value === true}
																					onChange={(e) => {
																						if (e.target.value === "true")
																							setValue(f.internalName, false, {
																								shouldValidate: true,
																							});
																						else
																							setValue(f.internalName, true, {
																								shouldValidate: true,
																							});
																					}}
																					className="h-5 border-gray-300 rounded-md min-w-5 "
																				/>
																				<label
																					htmlFor={f.internalName}
																					className="flex ml-2 text-sm font-normal text-justify text-gray-900 break-normal break-words items-top"
																				>
																					{f.label}
																					{f.description && (
																						<ReactCustomTooltip
																							id={f.internalName}
																							tooltip={<>{f.description}</>}
																						>
																							<InformationCircleIcon className="min-w-3.5 max-w-3.5 text-gray-500 mx-1 mt-0.5" />
																						</ReactCustomTooltip>
																					)}
																					{checkIfRequired(
																						customFieldsdata.fields ?? [],
																						f,
																					) && (
																						<span className="text-sm text-red-600 ">
																							*
																						</span>
																					)}
																				</label>
																			</div>
																		)}
																	/>
																</div>
																{errors?.[f.internalName] ? (
																	<div
																		className="flex items-center justify-start h-10 px-4 mt-2 text-sm text-red-700 break-words bg-red-100 rounded-lg gap-x-2 min-w-max"
																		id="email-error"
																	>
																		<XCircleIcon height={18} width={18} />
																		<div className="-mt-0.5">
																			{errors?.[f.internalName] &&
																				String(
																					errors?.[f.internalName]?.message,
																				)}
																		</div>
																	</div>
																) : null}
															</div>
														</ConditionalVisibility>
													);
												case Types.phoneNumber:
													return (
														<ConditionalVisibility
															key={f.internalName}
															field={f}
															formValues={watch() ?? getValues()}
															setValue={setValue}
															fields={customFieldsdata.fields ?? []}
														>
															<div
																key={f.internalName}
																className="block col-span-12 md:col-span-6"
															>
																<Controller
																	name={f.internalName}
																	control={control}
																	defaultValue={f.value}
																	render={({ field }) => (
																		<PhoneNumber
																			isRequired={checkIfRequired(
																				customFieldsdata.fields ?? [],
																				f,
																			)}
																			label={f.label}
																			placeholder={`Enter ${f.label}`}
																			tooltip={f.description}
																			value={field.value}
																			error={errors?.[f.internalName]}
																			onChange={(val) => {
																				setValue(
																					f.internalName,
																					val?.toString() ?? "",
																					{ shouldValidate: true },
																				);
																				field.onChange(val);
																			}}
																			onblur={field.onBlur}
																			interName={f.internalName}
																		/>
																	)}
																/>
															</div>
														</ConditionalVisibility>
													);
												case Types.upload:
													return (
														<ConditionalVisibility
															key={f.internalName}
															field={f}
															formValues={watch() ?? getValues()}
															setValue={setValue}
															fields={customFieldsdata.fields ?? []}
														>
															<div
																key={f.internalName}
																className="block col-span-12"
															>
																<Uploader
																	f={f}
																	errors={errors}
																	control={control}
																	tooltip={f.description}
																	formValues={watch() ?? getValues()}
																	getValues={getValues}
																	setValue={setValue}
																	trigger={trigger}
																/>
															</div>
														</ConditionalVisibility>
													);
												case Types.decimal:
													return (
														<ConditionalVisibility
															key={f.internalName}
															field={f}
															formValues={watch() ?? getValues()}
															setValue={setValue}
															fields={customFieldsdata.fields ?? []}
														>
															<div
																key={f.internalName}
																className="block col-span-12 md:col-span-6"
															>
																<Input
																	label={f.label}
																	type="text"
																	step="any"
																	tooltip={f.description}
																	placeholder={`Enter ${f.label}`}
																	register={register}
																	defaultValue={f.value}
																	name={f.internalName}
																	errors={errors}
																	isRequired={checkIfRequired(
																		customFieldsdata.fields ?? [],
																		f,
																	)}
																	onChange={(e) => {
																		let value = e.target.value;
																		value = value.replace(/[^0-9.]/g, "");
																		const decimalCount = (
																			value.match(/\./g) ?? []
																		).length;
																		if (decimalCount > 1) {
																			value = value.replace(/\.(?=.*\.)/g, "");
																		}
																		e.target.value = value;
																	}}
																	className={twMerge(
																		"w-full rounded-md mt-2.5 font-Inter text-[15px] text-[#5E5E5E] py-2.5 px-4",
																		f.is_sensitive_info
																			? "masked-password"
																			: "",
																	)}
																/>
															</div>
														</ConditionalVisibility>
													);
												case Types.date:
													return (
														<ConditionalVisibility
															key={f.internalName}
															field={f}
															formValues={watch() ?? getValues()}
															setValue={setValue}
															fields={customFieldsdata.fields ?? []}
														>
															<div
																key={f.internalName}
																className="block col-span-12 md:col-span-6"
															>
																<div className="mt-2.5">
																	<label className="text-xs font-medium leading-6 text-gray-900 font-Inter">
																		{f.label ?? ""}
																		{f.description && (
																			<ReactCustomTooltip
																				id={f.internalName}
																				tooltip={<>{f.description}</>}
																			>
																				<InformationCircleIcon className="min-w-3.5 max-w-3.5 text-gray-500 mx-1" />
																			</ReactCustomTooltip>
																		)}
																		{checkIfRequired(
																			customFieldsdata.fields ?? [],
																			f,
																		) && (
																			<span className="text-sm text-red-600 ">
																				*
																			</span>
																		)}
																	</label>
																	<Controller
																		name={f.internalName}
																		control={control}
																		defaultValue={formatDateValue(
																			f.value as string,
																		)}
																		render={({ field }) => (
																			<DatePicker
																				onChange={(val) => {
																					const dateValue = formatDateValue(
																						val?.toString(),
																					);
																					setValue(f.internalName, dateValue, {
																						shouldValidate: true,
																					});
																					field.onChange(dateValue);
																				}}
																				value={field.value || ""}
																				format="MM/DD/YYYY"
																				placeholder={`Select ${f.label}`}
																				minDate={new Date("01/01/1920")}
																				maxDate={todayEnd}
																				inputClass={DefaultInputClasses}
																				className="custom-calendar"
																				arrowStyle={{ border: 0 }}
																				containerClassName="w-full"
																				required={checkIfRequired(
																					customFieldsdata.fields ?? [],
																					f,
																				)}
																			/>
																		)}
																	/>
																</div>
																<p
																	className="mt-2 text-sm text-red-600"
																	id="date-error"
																>
																	{errors?.[f.internalName] &&
																		String(errors?.[f.internalName]?.message)}
																</p>
															</div>
														</ConditionalVisibility>
													);
												default:
													return <div key={"default"} className="hidden"></div>;
											}
										})}
									</div>
								</div>
							);
						})}
					</>
				)}
			</div>
			{/* )} */}
		</>
	);
};

export default CustomFields;
