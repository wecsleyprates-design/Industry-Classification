import React, { type ReactNode } from "react";
import { EditableField } from "@/components/EditableField";
import { getTaxIdLabel } from "@/lib/taxIdLabels";
import type { FieldSource } from "../../../../components/fieldSource.types";
import { getFieldValidationRules } from "../../utils/BusinessRegistrationTab/validation";
import { CardListItem } from "../CardListItem";

type Details = Array<{
	label: string;
	value: ReactNode;
	fieldSource?: FieldSource;
}>;

export interface TaxContentProps {
	taxDetails: Details;
	canEdit: boolean;
	getSaveStatus: (fieldKey: string) => "idle" | "saving" | "saved" | "error";
	handleEditComplete: (
		fieldKey: string,
		originalValue: string,
		newValue: string,
	) => void;
	suggestions: Record<string, any[]>;
	originalValues: Record<string, string>;
	countryCode: string;
}

export const TaxContent: React.FC<TaxContentProps> = ({
	taxDetails,
	canEdit,
	getSaveStatus,
	handleEditComplete,
	suggestions,
	originalValues,
	countryCode,
}) => {
	return (
		<>
			{taxDetails.map((item, index) => {
				// Map form field keys to API field keys
				const isBusinessName = item.label === "Business Name";
				const formFieldKey = isBusinessName ? "business_name" : "tin";
				const apiFieldKey = isBusinessName ? "legal_name" : "tin";
				const originalValue =
					originalValues[isBusinessName ? "businessName" : "tin"] ||
					"";
				const suggestionGroups = suggestions[formFieldKey] || [];

				// If editing is enabled and this is an editable field, use EditableField
				if (
					canEdit &&
					(formFieldKey === "business_name" || formFieldKey === "tin")
				) {
					return (
						<CardListItem
							key={index}
							label={item.label}
							value={
								<EditableField
									name={formFieldKey}
									inputType="text"
									onEditComplete={(
										fieldKey,
										origVal,
										newVal,
									) => {
										// Map form field key to API field key
										const mappedFieldKey =
											fieldKey === "business_name"
												? "legal_name"
												: fieldKey;
										handleEditComplete(
											mappedFieldKey,
											origVal,
											newVal,
										);
									}}
									editingEnabled={canEdit}
									saveStatus={getSaveStatus(apiFieldKey)}
									placeholder={
										formFieldKey === "business_name"
											? "Enter business name"
											: `Enter ${getTaxIdLabel(
													countryCode,
													"long",
												)}`
									}
									label={item.label}
									suggestionGroups={suggestionGroups}
									originalValue={originalValue}
									rules={
										formFieldKey === "tin"
											? getFieldValidationRules(
													"tin",
													countryCode,
												)
											: undefined
									}
								/>
							}
							fieldSource={item.fieldSource}
						/>
					);
				}

				return (
					<CardListItem
						key={index}
						label={item.label}
						value={item.value}
						fieldSource={item.fieldSource}
					/>
				);
			})}
		</>
	);
};
