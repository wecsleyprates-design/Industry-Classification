import React, { useEffect, useState } from "react";
import { type UseFormSetValue } from "react-hook-form";
import { evaluateCondition } from "@/lib/expression";
import { type Field } from "@/types/auth";
import { type inputProperty } from "./InviteCustomFields";
import { parse } from "./utils";

interface Props {
	children: React.ReactElement;
	field: inputProperty;
	formValues?: Record<string, any>;
	setValue?: UseFormSetValue<Record<string, any>>;
	fields?: Field[];
}

const ConditionalVisibility: React.FC<Props> = ({
	children,
	field,
	formValues,
	setValue,
	fields,
}) => {
	const [showField, setShowField] = useState(true);
	const [storedValue, setStoredValue] = useState<any>(null); // To preserve field value

	// Effect to handle visibility logic
	useEffect(() => {
		if (field) {
			const fieldVisibility = field?.rules?.find(
				(rule: any) => rule?.rule === "field_visibility",
			);

			if (fieldVisibility) {
				// Reverse visibility logic (default is false unless condition matches)
				setShowField(!(fieldVisibility?.condition?.visibility === "TRUE"));

				// Extract and evaluate the dependency
				const keys = fieldVisibility?.condition?.fields ?? [];
				const types = fields
					?.filter((val) =>
						keys?.find((key: string) => key === val.internalName),
					)
					.map((item) => ({
						key: item.internalName,
						property: item.property,
					}));

				const resolvedFields = types?.reduce((acc: any, item) => {
					if (item.property === "dropdown") {
						acc[item.key] = formValues?.[item.key]?.label?.trim() ?? "";
					} else if (item.property === "boolean") {
						acc[item.key] =
							formValues?.[item.key] && parse(formValues?.[item.key])
								? "TRUE"
								: "FALSE";
					} else if (item.property === "checkbox") {
						const inputValue = formValues?.[item.key];
						if (typeof inputValue === "object") {
							const inputName =
								fieldVisibility?.condition?.dependency?.split("=")[1];
							const fieldArray = Array.isArray(inputValue)
								? inputValue.map((val: any) => ({
										label: val?.label,
										checked: val?.checked,
									}))
								: [];
							const currentField = fieldArray.find(
								(val: any) => val?.label?.trim() === inputName.trim(),
							);
							if (currentField?.checked) {
								acc[item.key] = inputName?.trim();
							}
						}
					} else {
						acc[item.key] = formValues?.[item.key] ?? "";
					}
					return acc;
				}, {});

				// Update visibility state based on condition
				if (
					resolvedFields &&
					evaluateCondition(
						fieldVisibility?.condition?.dependency,
						resolvedFields,
					)
				) {
					setShowField(fieldVisibility?.condition?.visibility === "TRUE");
				}
			}
		}
	}, [JSON.stringify(field), JSON.stringify(formValues), fields]);

	// Effect to handle value preservation and resetting
	useEffect(() => {
		// Extract the field value from formValues or fields
		const fieldValue = Array.isArray(fields)
			? fields.find((val) => val.internalName === field.internalName)?.value
			: undefined;

		if (!showField) {
			// Store the value when field becomes invisible
			setStoredValue(formValues?.[field.internalName]);
			setValue?.(field.internalName, null, { shouldValidate: true }); // Clear field value in the form
		} else {
			// Restore value or set default when field becomes visible
			let valueToSet: any = storedValue ?? fieldValue;

			if (
				valueToSet === undefined &&
				field?.field_options?.defaultValue !== undefined
			) {
				valueToSet = field.field_options.defaultValue;
			}

			// Additional property handling for specific field types
			if (field.property === "dropdown" && valueToSet) {
				try {
					// Handle dropdown fields where value is a stringified object
					if (typeof valueToSet === "string") {
						valueToSet = JSON.parse(String(valueToSet)) ?? null;
					}
				} catch {
					// Fallback to creating a value-label pair if parsing fails
					valueToSet = { value: valueToSet, label: valueToSet };
				}
			} else if (field.property === "boolean") {
				valueToSet =
					valueToSet === "true" ? true : valueToSet === "false" ? false : null;
			} else if (field.property === "checkbox") {
				valueToSet = valueToSet ?? field?.field_options;
				valueToSet =
					typeof valueToSet === "string" && valueToSet === "null"
						? null
						: typeof valueToSet === "string"
							? JSON.parse(valueToSet)
							: valueToSet;
			} else if (field.property === "upload") {
				const maxNumFiles =
					field.rules?.find((rule: any) => rule.rule === "maxNumFiles")
						?.value ?? 1;

				const newFileObject = [];
				for (let i = 0; i < maxNumFiles; i++) {
					newFileObject.push({
						fileName: field?.value?.[i] || null,
						value_id: field?.value_id?.[i] || null,
					});
				}
				// Assign the new file object to the field if old not present
				valueToSet = storedValue ?? newFileObject;
			}

			// Validation should only occur if values are being re-filled, not when they are first visible..
			if (valueToSet)
				if (field.property === "upload") {
					if (valueToSet.filter((f: any) => f.fileName !== null).length)
						setValue?.(field.internalName, valueToSet, {
							shouldValidate: true,
						});
					else setValue?.(field.internalName, valueToSet);
				} else {
					if (field.property === "checkbox") {
						if (valueToSet.filter((f: any) => f.checked).length) {
							setValue?.(field.internalName, valueToSet, {
								shouldValidate: true,
							});
						} else {
							setValue?.(field.internalName, valueToSet);
						}
					} else
						setValue?.(field.internalName, valueToSet, {
							shouldValidate: true,
						});
				}
			else setValue?.(field.internalName, valueToSet);
		}
	}, [showField]);

	return <>{showField ? children : null}</>;
};

export default ConditionalVisibility;
