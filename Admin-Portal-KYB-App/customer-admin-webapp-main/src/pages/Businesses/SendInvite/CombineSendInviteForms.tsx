import React, { useEffect, useMemo, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { isPossiblePhoneNumber } from "react-phone-number-input";
import { useNavigate } from "react-router";
import { useSearchParams } from "react-router-dom";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import Button from "@/components/Button";
import { useConditionalAddBusinessFields } from "@/hooks/useConditionalAddBusinessFields";
import useCustomToast from "@/hooks/useCustomToast";
import { getItem } from "@/lib/localStorage";
import { toISO } from "@/lib/utils/dateUtil";
import { createBusinessSchema } from "@/lib/validation";
import { useSendInvitation } from "@/services/queries/businesses.query";
import { type PreFilledData } from "@/types/auth";
import CustomFields, {
	checkIfVisibleField,
	CustomInputType,
} from "./CustomField/InviteCustomFields";
import { schemaRuleSwitch } from "./CustomField/utils";
import SendInviteForm from "./SendInviteForm";

import { LOCALSTORAGE } from "@/constants/LocalStorage";
import { URL } from "@/constants/URL";

interface CustomFieldProps {
	customFieldsdata?: PreFilledData | null;
}

const CombineSendInviteForms: React.FC<CustomFieldProps> = ({
	customFieldsdata,
}) => {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const [customerId] = useState(getItem(LOCALSTORAGE?.customerId));
	const { successHandler, errorHandler } = useCustomToast();

	const isQuickAdd: boolean = Boolean(searchParams.get("isQuickAdd"));
	const isCheckInvites: boolean = Boolean(searchParams.get("check_invites"));

	const [businessName, setNewBusinessName] = useState<string>();

	// Step flow state
	const [step, setStep] = useState<"invite" | "customFields">("invite");
	const hasCustomFields = Boolean(customFieldsdata?.fields?.length);
	const showCustomFields = step === "customFields" && hasCustomFields;
	const { equifaxEnabled, ssnRequired } = useConditionalAddBusinessFields();

	const backPressHandler = () => {
		navigate(-1);
	};

	const {
		mutateAsync: sendInvitation,
		data: sendInvitationData,
		error: sendInvitationError,
		isPending: sendInvitationLoading,
	} = useSendInvitation();
	const defaultValues = useMemo(
		() => ({
			companyName: "",
			firstName: "",
			lastName: "",
			mobile: "",
			email: "",
			skipCreditCheck: false,
			bypassSSN: false,
			eSignTemplates: [] as string[],
		}),
		[],
	);
	// This method of useForm is used when custom fields are present
	const customFieldsMethods = useForm({
		mode: "onChange",
		defaultValues,
		resolver: yupResolver(
			customFieldsdata?.fields?.length && showCustomFields
				? createBusinessSchema.shape(
						customFieldsdata?.fields?.reduce<Record<string, any>>(
							(acc, field) => {
								let baseSchema:
									| yup.StringSchema
									| yup.NumberSchema
									| yup.AnyObject;

								if (field.property === "upload") {
									const isRequired = field?.rules?.find(
										(rule) => rule.rule === "required",
									);
									if (isRequired) baseSchema = yup.mixed();
									else {
										baseSchema = yup.mixed().nullable();
									}
								} else if (field.property === "dropdown") {
									const items = Object.keys(field?.field_options?.[0]).filter(
										(val) => val === "value" || val === "label",
									);
									const objectValues = items.reduce((objSchema, i) => {
										return {
											...objSchema,
											[i]: yup.string().optional().nullable().notRequired(),
										};
									}, {});
									baseSchema = yup.object().shape(objectValues).nullable();
								} else if (field.property === "checkbox") {
									const items = Object?.keys(field?.field_options?.[0] ?? {});
									const objectValues = items.reduce(
										(objSchema, i) => {
											return {
												...objSchema,
												[i]:
													i === "value"
														? yup
																.string()
																.nullable()
																.when("checked", (checked, schema) => {
																	if (checked[0] === true) {
																		return schema
																			.nonNullable()
																			.required("Input is required")
																			.typeError("Input is required")
																			.transform(
																				(value: any, originalValue: any) =>
																					originalValue === "" ? null : value,
																			);
																	}
																	return schema;
																})
														: yup.string().nullable(),
											};
										},
										{ checked: yup.boolean() },
									);
									const arraySchema = yup
										.array()
										.of(yup.object().shape(objectValues));
									baseSchema = arraySchema;
								} else if (field.property === "boolean") {
									baseSchema = yup
										.boolean()
										.optional()
										.nullable()
										.oneOf([true, false, null]);
								} else if (field.property === "integer") {
									baseSchema = yup
										.number()
										.transform((value) => (Number.isNaN(value) ? null : value))
										.nullable()
										.test(
											"is-decimal",
											"Please enter a number without decimals.",
											(value) =>
												value === null ||
												value === undefined ||
												Number.isInteger(value) ||
												Number(value) % 1 === 0,
										)
										.test(
											"is-valid-number",
											"Please enter a valid number.",
											(value) =>
												value === null ||
												value === undefined ||
												Number.isInteger(value),
										);
								} else if (
									field.property === "text" ||
									field.property === "full_text" ||
									field.property === "decimal"
								) {
									const type: string | number = CustomInputType[field.property];
									if (type === "string") {
										baseSchema = yup.string().nullable();
									} else {
										baseSchema = yup
											.number()
											.nullable()
											.transform((value) =>
												Number.isNaN(value) ? null : value,
											);
									}
								} else if (field.property === "email") {
									baseSchema = yup
										.string()
										.email("Please enter valid email address");
								} else if (field.property === "phone_number") {
									baseSchema = yup
										.string()
										.test(
											"is-valid-mobile",
											"Please enter valid input",
											function (value) {
												if (typeof value === "string" && value.trim() !== "") {
													return value.startsWith("+1")
														? isPossiblePhoneNumber(value)
														: isPossiblePhoneNumber(`+1${value}`);
												}
												return true;
											},
										);
								} else if (field.property === "date") {
									baseSchema = yup
										.string()
										.nullable()
										.test(
											"valid-date",
											"Please enter a valid date in MM/DD/YYYY format",
											(value) => {
												// Allow null/empty values, but validate non-empty values
												if (!value || value.trim() === "") return true;
												return toISO(value) !== null;
											},
										);
								} else {
									baseSchema = yup.string().nullable();
								}

								acc[field.internalName] = field.rules?.filter(
									(item) => item.rule !== "field_visibility",
								).length
									? field?.rules
											?.filter((rule) => rule)
											?.reduce((schema, rule) => {
												return schemaRuleSwitch(
													field,
													rule,
													schema,
													customFieldsdata?.fields,
												);
											}, baseSchema)
									: baseSchema.nullable().optional();

								return acc;
							},
							{},
						) as any,
					)
				: createBusinessSchema,
		) as any,
		shouldUnregister: false, // keeps values when switching steps
	});

	const {
		formState: { dirtyFields },
	} = customFieldsMethods;

	const onSubmit = async (data: any) => {
		const {
			companyName: { business_id: businessId, name },
			firstName,
			lastName,
			mobile,
			email,
			companyMobile,
			eSignTemplates,
			skipCreditCheck,
			bypassSSN,
		} = data;

		let files: any[] | null = null;
		let payload = {};

		if (customFieldsdata && showCustomFields) {
			const keys = Object.keys(data);
			const filteredFields =
				customFieldsdata?.fields
					?.filter((field) => keys.includes(field.internalName))
					?.map((val) => {
						const isVisible = checkIfVisibleField(
							val,
							data,
							customFieldsdata.fields,
						);
						if (
							isVisible &&
							![null, undefined].includes(data[val.internalName])
						) {
							if (val.property === "checkbox") {
								if (
									(customFieldsdata?.fields?.find(
										(field) => field.id === val.id,
									)?.value === null &&
										data[val.internalName].find(
											(field: any) => field.checked === true,
										)) ||
									(customFieldsdata?.fields?.find(
										(field) => field.id === val.id,
									)?.value !== null &&
										JSON.stringify(data[val.internalName]) !==
											JSON.stringify(
												customFieldsdata?.fields?.find(
													(field) => field.id === val.id,
												),
											))
								) {
									return {
										[val.internalName]: JSON.stringify(data[val.internalName]),
									};
								} else return null;
							}
							if (val.property === "dropdown") {
								return {
									[val.internalName]: JSON.stringify(data[val.internalName]),
								};
							}
							if (val.property === "date") {
								const isoValue = toISO(data[val.internalName] as string);
								return {
									[val.internalName]: isoValue ?? null,
								};
							}
							if (val.property === "upload") {
								if (Array.isArray(data[val.internalName])) {
									files = [
										...(files || []),
										...data[val.internalName].map((file: any) => file.fileName),
									];
								}
								return {
									[val.internalName]: JSON.stringify(
										data[val.internalName].map(
											(file: any) => (file.fileName as File)?.name,
										) as string,
									),
								};
							}
							return {
								[val.internalName]: data[val.internalName],
							};
						} else if (
							customFieldsdata?.fields?.find(
								(field) => field.internalName === val.internalName,
							)?.value
						) {
							if (
								val.property === "checkbox" &&
								JSON.stringify(val?.value) !==
									JSON.stringify(
										customFieldsdata?.fields?.find(
											(field) => field.internalName === val.internalName,
										)?.value,
									)
							) {
								return null;
							}
							return {
								[val.internalName]: data[val.internalName],
							};
						}
						return null;
					})
					.filter((val) => val) ?? [];
			payload = {
				custom_fields: Object.assign({}, ...filteredFields),
				...(files !== null && { files }),
			};
		}

		await sendInvitation({
			customerId: customerId ?? "",
			payload: {
				...payload,
				...(businessName
					? {
							new_business: {
								name: businessName,
								...(companyMobile && { mobile: companyMobile }),
							},
						}
					: {
							existing_business: {
								...(businessId && { business_id: businessId }),
								name,
								...(isQuickAdd ? { is_quick_add: isQuickAdd } : {}),
							},
						}),
				new_applicants: [
					{
						first_name: firstName,
						last_name: lastName,
						email,
						...(mobile && { mobile }),
					},
				],
				...(equifaxEnabled &&
					dirtyFields?.skipCreditCheck && {
						skip_credit_check: skipCreditCheck,
					}),
				...(ssnRequired && dirtyFields?.bypassSSN && { bypass_ssn: bypassSSN }),
				...(isCheckInvites ? { check_invites: isCheckInvites } : {}),
				...(eSignTemplates ? { esign_templates: eSignTemplates } : {}),
			},
		});
	};

	useEffect(() => {
		if (sendInvitationData) {
			successHandler({
				message: sendInvitationData?.message,
			});
			navigate(URL.BUSINESSES);
		}
	}, [sendInvitationData]);

	useEffect(() => {
		if (sendInvitationError) {
			errorHandler(sendInvitationError);
		}
	}, [sendInvitationError]);

	return (
		<div>
			<FormProvider {...customFieldsMethods}>
				<form onSubmit={customFieldsMethods.handleSubmit(onSubmit)}>
					<div hidden={step !== "invite"}>
						<SendInviteForm
							businessName={businessName}
							setNewBusinessName={setNewBusinessName}
						/>
					</div>
					<div hidden={step !== "customFields"}>
						<CustomFields
							customFieldsdata={customFieldsdata}
							showCustomFields
						/>
					</div>

					<div className="flex items-center justify-between mt-6 border-t gap-x-3 border-gray-900/10">
						<Button
							className="mt-5 gap-x-2 border rounded border-gray-200 shadow-none text-sm font-medium text-slate-700"
							outline
							onClick={backPressHandler}
							color="transparent"
							type="button"
						>
							Cancel
						</Button>

						<div className="w-fit flex flex-row flex-nowrap gap-x-3">
							{step === "customFields" && (
								<>
									<Button
										type="button"
										color="transparent"
										outline
										className="mt-5 text-sm font-medium text-slate-700 gap-x-2 border border-gray-200 rounded"
										onClick={() => {
											setStep("invite");
										}}
									>
										Back
									</Button>
									<Button
										type="submit"
										className="text-white flex gap-x-2 bg-gray-800 mt-5 hover:bg-gray-900"
										disabled={sendInvitationLoading}
										isLoading={sendInvitationLoading}
									>
										Send invitation
									</Button>
								</>
							)}

							{step === "invite" &&
								(hasCustomFields ? (
									<Button
										type="button"
										className="text-white flex gap-x-2 bg-gray-800 mt-5 hover:bg-gray-900"
										onClick={async () => {
											// Validate form data against createBusinessSchema
											await customFieldsMethods.trigger();

											const isValid = await createBusinessSchema.isValid(
												customFieldsMethods.getValues(),
											);
											if (isValid) {
												setStep("customFields");
											}
										}}
									>
										Next
									</Button>
								) : (
									<Button
										type="submit"
										className="text-white flex gap-x-2 bg-gray-800 mt-5 hover:bg-gray-900"
										disabled={sendInvitationLoading}
										isLoading={sendInvitationLoading}
									>
										Send invitation
									</Button>
								))}
						</div>
					</div>
				</form>
			</FormProvider>
		</div>
	);
};

export default CombineSendInviteForms;
