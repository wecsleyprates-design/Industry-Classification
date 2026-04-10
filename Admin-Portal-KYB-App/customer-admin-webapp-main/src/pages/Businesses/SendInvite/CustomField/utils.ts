import { evaluateCondition } from "@/lib/expression";
import { capitalize } from "@/lib/helper";
import { type Field } from "@/types/auth";

export const parse = (value: string) => {
	try {
		const res = JSON.parse(value);
		return res;
	} catch (error) {
		console.error(error);
		return "";
	}
};

// Schema Rules Validations
export const schemaRuleSwitch = (
	field: Field,
	rule: any,
	schema: any,
	fields: Field[],
) => {
	switch (rule?.rule) {
		case "required":
			// Check for conditional visiblity before applying required. Replicate required rule in conditional visiblity
			if (
				!field?.rules?.find((rule: any) => rule.rule === "field_visibility")
			) {
				return field.property === "upload"
					? schema.test(
							"upload required",
							field?.rules?.find((rule: any) => rule.rule === "minNumFiles")
								? field?.rules?.find((rule: any) => rule.rule === "minNumFiles")
										?.value === 1
									? "This field is required. Please upload a file."
									: `Please upload at least  ${
											field?.rules?.find(
												(rule: any) => rule?.rule === "minNumFiles",
											)?.value
										} file(s).`
								: "This field is required. Please upload a file.",
							(value: any) => {
								// Check if any file has been uploaded
								const isFileUploaded = value?.some(
									(file: { fileName: any; value_id: any }) =>
										file.fileName !== null,
								);
								return isFileUploaded; // Returns true if fileName is not null
							},
						)
					: schema._type === "array"
						? schema
								.required(`${capitalize(field.label)} is required`)
								.typeError(`${capitalize(field.label)} is required`)
								.test(
									"at-least-one-checked",
									"At least one checkbox must be checked",
									(checkboxes: any) => {
										return (
											checkboxes === null ||
											checkboxes.some(
												(checkbox: any) => checkbox.checked === true,
											)
										);
									},
								)
								.test(
									"all-values",
									"All form values are required",
									(checkboxes: any) => {
										return (
											checkboxes === null ||
											checkboxes.every(
												(checkbox: any) =>
													checkbox.value !== null || checkbox.value !== "",
											)
										);
									},
								)
						: schema.type === "boolean"
							? schema
									.oneOf(
										[true, false],
										`This field requires confirmation. Please check or uncheck the box.`,
									)
									.required(
										`This field requires confirmation. Please check or uncheck the box.`,
									)
							: schema
									.required(`${capitalize(field.label)} is required`)
									.typeError(`${capitalize(field.label)} is required`);
			}
			return schema;
		case "minLength":
			return schema.min(
				Number(rule?.value),
				`Minimum length for ${capitalize(field.label)} is ${
					rule?.value
				} characters`,
			);
		case "maxLength":
			return schema.max(
				Number(rule?.value),
				`Maximum length for ${capitalize(field.label)} is ${
					rule?.value
				} characters`,
			);
		case "minimum":
			return schema._type === "number"
				? field?.rules?.find((rule) => rule.rule === "required") // if field is not required then set nullable
					? schema
							.transform((value: any, originalValue: any) =>
								originalValue === "" ? null : value,
							)
							.min(rule?.value ?? 0, `Minimum of ${rule?.value} required`)
					: schema
							.transform((value: any, originalValue: any) =>
								originalValue === "" ? null : value,
							)
							.nullable()
							.min(rule?.value ?? 0, `Minimum of ${rule?.value} required`)
				: schema;
		case "maximum":
			return schema._type === "number"
				? field?.rules?.find((rule) => rule.rule === "required") // if field is not required then set nullable
					? schema
							.transform((value: any, originalValue: any) =>
								originalValue === "" ? null : value,
							)
							.max(rule?.value ?? 0, `Must be less than ${rule?.value}`)
					: schema
							.transform((value: any, originalValue: any) =>
								originalValue === "" ? null : value,
							)
							.nullable()
							.max(rule?.value ?? 0, `Must be less than ${rule?.value}`)
				: schema;

		case "decimalPlaces":
			return schema.test(
				"decimal Places",
				`Please enter values upto ${rule?.value} decimal places`,
				(value: any) => {
					if (value) {
						const num = value?.toString();
						const decimalPoints = num?.split(".")?.[1];
						if (!decimalPoints) return true;
						return decimalPoints?.length <= Number(rule.value);
					} else {
						return true;
					}
				},
			);
		case "field_visibility":
			return schema.when(
				rule?.condition.fields,
				(dependencyValue: any, schema: any) => {
					const keys = rule?.condition?.fields ?? [];
					const types = fields
						?.filter((val) => keys?.includes(val.internalName))
						.map((item) => ({
							key: item.internalName,
							property: item.property,
						}));

					const res = types?.reduce((acc: any, item, index) => {
						if (item.property === "dropdown") {
							acc[item.key] = dependencyValue?.[index]?.label?.trim() ?? "";
						} else if (item.property === "boolean") {
							acc[item.key] = dependencyValue?.[index] ? "TRUE" : "FALSE";
						} else if (item.property === "checkbox") {
							const inputValue = dependencyValue?.[index];

							if (
								rule?.condition?.fields?.includes(item.key) &&
								!dependencyValue.includes(null)
							) {
								if (typeof inputValue === "object") {
									const inputName = rule?.condition?.dependency?.split("=")[1];
									const fieldArrray =
										typeof dependencyValue?.[index]?.map(
											(val: any) => val?.label,
										) !== "object"
											? (parse(
													dependencyValue?.[index]?.map((val: any) => ({
														label: val?.label,
														checked: val?.checked,
													})),
												) ?? [])
											: (dependencyValue?.[index]?.map((val: any) => ({
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
						} else {
							acc[item.key] = dependencyValue?.[index];
						}
						return acc;
					}, {});

					const isConditionMet = evaluateCondition(
						rule?.condition?.dependency,
						res,
					);
					// Add required and file upload schema based on if field is visible or hidden
					if (
						(isConditionMet && rule?.condition?.visibility === "FALSE") ||
						(!isConditionMet && rule?.condition?.visibility === "TRUE")
					) {
						return schema.optional().notRequired();
					} else if (field.property === "upload") {
						return schema
							.optional()
							.test(
								"upload required",
								field?.rules?.find((rule: any) => rule.rule === "minNumFiles")
									? field?.rules?.find(
											(rule: any) => rule.rule === "minNumFiles",
										)?.value === 1
										? "This field is required. Please upload a file."
										: `Please upload at least  ${
												field?.rules?.find(
													(rule: any) => rule.rule === "minNumFiles",
												)?.value
											} file(s).`
									: "This field is required. Please upload a file.",
								(value: any) => {
									// Check if any file has been uploaded
									const isFileUploaded = value?.some(
										(file: { fileName: any; value_id: any }) =>
											file.fileName !== null,
									);
									return field?.rules?.find(
										(rule: any) => rule.rule === "required",
									)
										? isFileUploaded
										: true; // Returns true if fileName is not null
								},
							)
							.test(
								"Minimum files required",
								field?.rules?.find((rule: any) => rule.rule === "minNumFiles")
									?.value === 1
									? "Please upload a file."
									: `Please upload at least  ${
											field?.rules?.find(
												(rule: any) => rule.rule === "minNumFiles",
											)?.value
										} file(s).`,
								(value: any) => {
									// Check if any file has been uploaded
									const isFileUploaded =
										value?.filter(
											(file: { fileName: any; value_id: any }) =>
												file.fileName !== null,
										).length ?? 0;
									return field?.rules?.find(
										(rule: any) => rule.rule === "required",
									)
										? isFileUploaded >=
												field?.rules?.find(
													(rule: any) => rule.rule === "minNumFiles",
												)?.value
										: isFileUploaded
											? isFileUploaded >=
												field?.rules?.find(
													(rule: any) => rule.rule === "minNumFiles",
												)?.value
											: true;
								},
							)
							.test(
								"Max files",
								`You can upload up to ${
									field?.rules?.find((rule: any) => rule.rule === "maxNumFiles")
										?.value ?? 1
								} file(s) only.`,
								(value: any) => {
									// Check if any file has been uploaded
									const isFileUploaded =
										value?.filter(
											(file: { fileName: any; value_id: any }) =>
												file.fileName !== null,
										).length ?? 0;
									return (
										isFileUploaded <=
										field?.rules?.find(
											(rule: any) => rule.rule === "maxNumFiles",
										)?.value
									);
								},
							);
					} else if (field.rules?.some((r) => r.rule === "required")) {
						if (schema._type === "array")
							return schema
								.required(`${capitalize(field.label)} is required`)
								.typeError(`${capitalize(field.label)} is required`)
								.test(
									"at-least-one-checked",
									"At least one checkbox must be checked",
									(checkboxes: any) => {
										return (
											checkboxes === null ||
											checkboxes.some(
												(checkbox: any) => checkbox.checked === true,
											)
										);
									},
								)
								.test(
									"all-values",
									"All form values are required",
									(checkboxes: any) => {
										return (
											checkboxes === null ||
											checkboxes.every(
												(checkbox: any) =>
													checkbox.value !== null || checkbox.value !== "",
											)
										);
									},
								);
						else if (schema.type === "boolean")
							return schema
								.oneOf(
									[true, false],
									`This field requires confirmation. Please check or uncheck the box.`,
								)
								.required(
									`This field requires confirmation. Please check or uncheck the box.`,
								);
						else
							return schema
								.required(`${capitalize(field.label)} is required`)
								.transform((value: any, originalValue: any) =>
									originalValue === "" ? undefined : value,
								)
								.typeError(`${capitalize(field.label)} is required`);
					} else {
						return schema.optional();
					}
				},
			);

		case "sum":
			return schema._type === "array"
				? schema.test(
						"sum",
						`The total for the ${
							field?.label?.toLocaleLowerCase() ?? ""
						} must not exceed ${rule.value}`,
						(checkboxes: any) => {
							const sum = checkboxes.reduce((s: number, item: any) => {
								return s + Number(item.value);
							}, 0);
							return sum <= Number(rule.value);
						},
					)
				: schema;
		case "equal":
			return schema._type === "array"
				? schema.test(
						"equal",
						`The total for the ${
							field?.label?.toLocaleLowerCase() ?? ""
						} should be equal to ${rule.value}`,
						(checkboxes: any) => {
							const sum = checkboxes.reduce((s: number, item: any) => {
								return s + Number(item.value);
							}, 0);
							return sum === Number(rule.value);
						},
					)
				: schema;

		case "minNumFiles":
			return field.property === "upload" &&
				!field?.rules?.find((rule: any) => rule.rule === "field_visibility")
				? schema.test(
						"Minimum files required",
						field?.rules?.find((rule: any) => rule.rule === "minNumFiles")
							?.value === 1
							? "Please upload a file."
							: `Please upload at least  ${
									field?.rules?.find((rule: any) => rule.rule === "minNumFiles")
										?.value
								} file(s).`,
						(value: any) => {
							// Check if any file has been uploaded
							const isFileUploaded =
								value?.filter(
									(file: { fileName: any; value_id: any }) =>
										file.fileName !== null,
								).length ?? 0;
							return field?.rules?.find((rule: any) => rule.rule === "required")
								? isFileUploaded >=
										field?.rules?.find(
											(rule: any) => rule.rule === "minNumFiles",
										)?.value
								: isFileUploaded
									? isFileUploaded >=
										field?.rules?.find(
											(rule: any) => rule.rule === "minNumFiles",
										)?.value
									: true;
						},
					)
				: schema;

		case "maxNumFiles":
			return field.property === "upload"
				? schema.test(
						"Max files",
						`You can upload up to ${
							field?.rules?.find((rule: any) => rule.rule === "maxNumFiles")
								?.value ?? 1
						} file(s) only.`,
						(value: any) => {
							// Check if any file has been uploaded
							const isFileUploaded =
								value?.filter(
									(file: { fileName: any; value_id: any }) =>
										file.fileName !== null,
								).length ?? 0;

							return (
								isFileUploaded <=
								field?.rules?.find((rule: any) => rule.rule === "maxNumFiles")
									?.value
							);
						},
					)
				: schema;

		default:
			return schema;
	}
};
