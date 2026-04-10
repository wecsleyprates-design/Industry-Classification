import React, { useMemo } from "react";
import { FormProvider } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { useFlags } from "launchdarkly-react-client-sdk";
import { toast } from "sonner";
import CaseProgressOrScore from "@/components/CaseProgressOrScore/CaseProgressOrScore";
import { EditableField } from "@/components/EditableField/EditableField";
import type {
	EditableFieldInputType,
	SaveStatus,
	SuggestionOption,
} from "@/components/EditableField/types";
import { useGetCaseDetails } from "@/hooks";
import { useCaseEditPermission } from "@/hooks/useCaseEditPermission";
import { useGetCurrentTemplateFields } from "@/services/queries/case.query";
import { useAppContextStore } from "@/store/useAppContextStore";
import { type CustomField } from "@/types/case";
import { EditableCheckboxGroup } from "./EditableCheckboxGroup";
import { EditableUploadField } from "./EditableUploadField";
import { type CustomFieldKey, useCustomFieldsForm } from "./hooks";

import { VALUE_NOT_AVAILABLE } from "@/constants";
import FEATURE_FLAGS from "@/constants/FeatureFlags";
import { GUEST_USER, USER_ROLE } from "@/constants/UserConstant";
import {
	DisplayFieldValue,
	FileDownloads,
	InternalFieldFooter,
} from "@/page/Cases/CaseDetails/components";
import type { FieldSource } from "@/page/Cases/CaseDetails/components/fieldSource.types";
import { SYSTEM_SOURCE } from "@/page/Cases/CaseDetails/components/fieldSource.types";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { type WorthScoreProps } from "@/ui/worth-score";

export interface CaseCustomFieldsTabProps {
	worthScore: WorthScoreProps;
	customFields: CustomField[];
}

/**
 * Check if a custom field was internally provided (not by the applicant)
 */
const isInternallyProvided = (field: CustomField): boolean => {
	return Boolean(
		field.user &&
		(field.user.role !== USER_ROLE.APPLICANT ||
			(field.user?.first_name === GUEST_USER.GUEST_FIRST_NAME &&
				field.user?.last_name === GUEST_USER.GUEST_LAST_NAME &&
				!!field.user?.email?.includes(GUEST_USER.GUEST_EMAIL_PREFIX))),
	);
};

const getCustomFieldSource = (field: CustomField): FieldSource => {
	if (!field.user) return SYSTEM_SOURCE;

	const isInternal = isInternallyProvided(field);
	if (isInternal) {
		const name = [field.user.first_name, field.user.last_name]
			.filter(Boolean)
			.join(" ");
		return {
			type: "internal",
			userName: name || undefined,
		};
	}

	if (field.user.role === USER_ROLE.APPLICANT) {
		const name = [field.user.first_name, field.user.last_name]
			.filter(Boolean)
			.join(" ");
		return {
			type: "applicant",
			userName: name || undefined,
		};
	}

	return SYSTEM_SOURCE;
};

/**
 * Map custom field property type to EditableField input type
 */
const getInputType = (
	property: CustomField["property"],
): EditableFieldInputType => {
	switch (property) {
		case "integer":
		case "decimal":
			return "number";
		case "dropdown":
		case "boolean":
			return "dropdown";
		case "date":
			return "date";
		case "text":
		case "full_text":
		case "alphanumeric":
		case "phone_number":
		case "email":
		default:
			return "text";
	}
};

/**
 * Get dropdown suggestions for boolean fields
 */
const getBooleanSuggestions = (): SuggestionOption[] => [
	{ label: "Yes", value: "Yes" },
	{ label: "No", value: "No" },
];

/**
 * Format a custom field value for display (read-only mode)
 */
const formatValue = (field: CustomField): React.ReactNode => {
	const fieldSource = getCustomFieldSource(field);

	switch (field.property) {
		case "boolean": {
			const value =
				field.value === "true" || field.value === "Yes" ? "Yes" : "No";

			return (
				<DisplayFieldValue value={value} fieldSource={fieldSource} />
			);
		}
		case "dropdown": {
			const value = String(field.value ?? VALUE_NOT_AVAILABLE).trim();

			return (
				<DisplayFieldValue value={value} fieldSource={fieldSource} />
			);
		}
		case "decimal": {
			const stringValue = Array.isArray(field.value)
				? String(field.value[0] ?? VALUE_NOT_AVAILABLE)
				: typeof field.value === "object" && field.value !== null
					? String(
							(field.value as { value: string }).value ??
								VALUE_NOT_AVAILABLE,
						)
					: String(field.value ?? VALUE_NOT_AVAILABLE);

			const internalName = field.internalName?.toLowerCase();

			const displayValue = internalName?.includes("percent")
				? `${stringValue}%`
				: stringValue;

			return (
				<DisplayFieldValue
					value={displayValue}
					fieldSource={fieldSource}
				/>
			);
		}
		case "upload": {
			// For "upload" custom fields, field.fileName should be an array of file names
			// and field.value should be an array of corresponding signed URLs, matched by index.
			// The following normalizations are a safety measure to avoid runtime errors.
			const fileNames: string[] = Array.isArray(field.fileName)
				? field.fileName
				: field.fileName != null
					? [String(field.fileName)]
					: [];

			const fileValues: string[] = Array.isArray(field.value)
				? field.value.map(String)
				: field.value != null
					? [String(field.value)]
					: [];

			const files: Array<{ fileName: string; signedUrl: string }> =
				fileValues.map((value: string, idx: number) => ({
					fileName: fileNames[idx] ?? "",
					signedUrl: value,
				}));

			return <FileDownloads files={files} fieldSource={fieldSource} />;
		}
		case "checkbox":
			try {
				const parsedValue =
					typeof field.value === "string"
						? JSON.parse(field.value)
						: field.value;
				if (Array.isArray(parsedValue)) {
					return (
						<div className="border divide-y rounded-xl">
							{parsedValue
								.filter((item: any) => item.checked)
								.map((item: any, idx: number) => (
									<div key={idx} className="p-4">
										<DisplayFieldValue
											value={item.label}
											fieldSource={fieldSource}
										/>
									</div>
								))}
						</div>
					);
				}
				return (
					<DisplayFieldValue
						value={String(field.value ?? "")}
						fieldSource={fieldSource}
					/>
				);
			} catch {
				return (
					<DisplayFieldValue
						value={String(field.value ?? "")}
						fieldSource={fieldSource}
					/>
				);
			}
		default:
			return (
				<DisplayFieldValue
					value={String(field.value ?? "")}
					fieldSource={fieldSource}
				/>
			);
	}
};

/**
 * Read-only custom field row (when editing is disabled)
 */
const ReadOnlyCustomFieldRow: React.FC<{ field: CustomField }> = ({
	field,
}) => {
	return (
		<div className="grid grid-cols-2 gap-4 py-5 border-b border-gray-100 last:border-0">
			<div className="text-sm font-medium tracking-wide text-gray-500">
				{field.label}
			</div>
			{formatValue(field)}
		</div>
	);
};

interface EditableCustomFieldRowProps {
	field: CustomField;
	editingEnabled: boolean;
	getSaveStatus: (fieldKey: CustomFieldKey) => SaveStatus;
	getOriginalValue: (fieldKey: CustomFieldKey) => string;
	onEditComplete: (
		fieldKey: CustomFieldKey,
		originalValue: string,
		newValue: string,
	) => void;
	dropdownOptions?: SuggestionOption[];
}

/**
 * Editable custom field row (when editing is enabled)
 */
const EditableCustomFieldRow: React.FC<EditableCustomFieldRowProps> = ({
	field,
	editingEnabled,
	getSaveStatus,
	getOriginalValue,
	onEditComplete,
	dropdownOptions,
}) => {
	const inputType = getInputType(field.property);
	const fieldSource = getCustomFieldSource(field);

	const suggestions =
		field.property === "boolean"
			? getBooleanSuggestions()
			: dropdownOptions;

	const formatDisplayValue =
		field.property === "decimal" &&
		field.internalName?.toLowerCase().includes("percent")
			? (value: string) => (value ? `${value}%` : VALUE_NOT_AVAILABLE)
			: undefined;

	const renderFieldInput = (): React.ReactNode => {
		switch (field.property) {
			case "checkbox":
				return (
					<EditableCheckboxGroup
						fieldId={field.id}
						editingEnabled={editingEnabled}
						saveStatus={getSaveStatus(field.id)}
						originalValue={getOriginalValue(field.id)}
						onEditComplete={onEditComplete}
						fieldSource={fieldSource}
					/>
				);
			case "upload": {
				const fileNames: string[] = Array.isArray(field.fileName)
					? field.fileName
					: field.fileName != null
						? [String(field.fileName)]
						: [];
				return (
					<EditableUploadField
						fieldId={field.id}
						initialFileNames={fileNames}
						editingEnabled={editingEnabled}
						saveStatus={getSaveStatus(field.id)}
						originalValue={getOriginalValue(field.id)}
						onEditComplete={onEditComplete}
						fieldSource={fieldSource}
					/>
				);
			}
			default:
				return (
					<EditableField
						name={field.id}
						inputType={inputType}
						editingEnabled={editingEnabled}
						saveStatus={getSaveStatus(field.id)}
						originalValue={getOriginalValue(field.id)}
						onEditComplete={onEditComplete}
						suggestions={suggestions}
						formatDisplayValue={formatDisplayValue}
						label={field.label}
						placeholder={`Enter ${field.label.toLowerCase()}...`}
						step={field.property === "decimal" ? 0.01 : undefined}
						className="w-fit"
						fieldSource={fieldSource}
					/>
				);
		}
	};

	return (
		<div className="grid grid-cols-2 gap-4 py-5 border-b border-gray-100 last:border-0">
			<div className="text-sm font-medium tracking-wide text-gray-500">
				{field.label}
			</div>
			{renderFieldInput()}
		</div>
	);
};

interface StepSectionProps {
	title: string;
	fields: CustomField[];
	editingEnabled: boolean;
	editableFieldIds: Set<string> | null;
	getSaveStatus: (fieldKey: CustomFieldKey) => SaveStatus;
	getOriginalValue: (fieldKey: CustomFieldKey) => string;
	onEditComplete: (
		fieldKey: CustomFieldKey,
		originalValue: string,
		newValue: string,
	) => void;
	dropdownOptionsMap: Map<string, SuggestionOption[]>;
}

/**
 * Section component that groups fields by step name
 */
const StepSection: React.FC<StepSectionProps> = ({
	title,
	fields,
	editingEnabled,
	editableFieldIds,
	getSaveStatus,
	getOriginalValue,
	onEditComplete,
	dropdownOptionsMap,
}) => (
	<Card>
		<CardHeader>
			<CardTitle className="text-lg font-semibold tracking-wide text-gray-800">
				{title}
			</CardTitle>
		</CardHeader>
		<CardContent>
			<div>
				{fields
					.sort((a, b) => a.sequence_number - b.sequence_number)
					.map((field) => {
						const fieldEditable =
							editingEnabled &&
							(editableFieldIds === null ||
								editableFieldIds.has(field.id));

						return fieldEditable ? (
							<EditableCustomFieldRow
								key={field.id}
								field={field}
								editingEnabled
								getSaveStatus={getSaveStatus}
								getOriginalValue={getOriginalValue}
								onEditComplete={onEditComplete}
								dropdownOptions={dropdownOptionsMap.get(
									field.id,
								)}
							/>
						) : (
							<ReadOnlyCustomFieldRow
								key={field.id}
								field={field}
							/>
						);
					})}
			</div>
		</CardContent>
	</Card>
);

/**
 * Read-only section component (when editing is disabled)
 */
const ReadOnlyStepSection: React.FC<{
	title: string;
	fields: CustomField[];
}> = ({ title, fields }) => (
	<Card>
		<CardHeader>
			<CardTitle className="text-lg font-semibold tracking-wide text-gray-800">
				{title}
			</CardTitle>
		</CardHeader>
		<CardContent>
			<div>
				{fields
					.sort((a, b) => a.sequence_number - b.sequence_number)
					.map((field) => (
						<ReadOnlyCustomFieldRow key={field.id} field={field} />
					))}
			</div>
		</CardContent>
	</Card>
);

export const CustomFieldsTab: React.FC<{ caseId: string }> = ({ caseId }) => {
	const { customerId } = useAppContextStore();
	const navigate = useNavigate();
	const flags = useFlags();

	const { caseData, caseError, caseIdQueryLoading } = useGetCaseDetails({
		customerId,
		caseId,
	});

	// Check if inline editing is enabled via feature flag and permissions
	const isCustomFieldsInlineEditingEnabled =
		flags[FEATURE_FLAGS.PAT_874_CM_APP_EDITING] ?? false;
	const canEdit = useCaseEditPermission();
	const editingEnabled = isCustomFieldsInlineEditingEnabled && canEdit;

	const businessId = caseData?.data?.business?.id ?? "";

	// Get the template ID - for now we use business_id as a proxy since the API
	// endpoint for custom fields uses business context.
	// TODO: Update once template_id is available in the API response
	const templateId = businessId;

	// Fetch current template fields to determine which fields are editable.
	// When a template is replaced, only fields that still exist in the active
	// template can be inline-edited; the rest are rendered read-only.
	const { data: currentTemplateData } =
		useGetCurrentTemplateFields(businessId);

	const editableFieldIds = useMemo((): Set<string> | null => {
		if (!currentTemplateData?.data) return null;
		return new Set(
			currentTemplateData.data.map(
				(f: { field_id: string }) => f.field_id,
			),
		);
	}, [currentTemplateData]);

	const customFields = useMemo(() => {
		if (!caseData?.data?.custom_fields) {
			return [];
		}

		return caseData.data.custom_fields
			.filter((field) => {
				return !field.internalName
					?.toLowerCase()
					?.startsWith("processor_");
			})
			.map((field): CustomField => {
				const baseField: Partial<CustomField> = {
					id: field.id,
					label: field.label,
					value: field?.value ?? VALUE_NOT_AVAILABLE,
					is_sensitive: field.is_sensitive,
					internalName: field.internalName,
					step_name: field.step_name,
					sequence_number: field.sequence_number,
					rules: field.rules ?? [],
					property: field.property,
					fileName: field.fileName,
					field_options: field.field_options,
					user: field.user,
				};

				return baseField as CustomField;
			});
	}, [caseData?.data?.custom_fields]);

	// Initialize form for inline editing
	const { form, getSaveStatus, getOriginalValue, handleEditComplete } =
		useCustomFieldsForm({
			customFields,
			businessId,
			caseId,
			templateId,
			isLoading: caseIdQueryLoading,
		});

	// Build dropdown options map for fields that have field_options
	const dropdownOptionsMap = useMemo(() => {
		const map = new Map<string, SuggestionOption[]>();
		customFields.forEach((field) => {
			if (
				field.field_options &&
				Array.isArray(field.field_options) &&
				field.field_options.length > 0
			) {
				const options: SuggestionOption[] = field.field_options.map(
					(opt) => ({
						label: opt.label,
						value: opt.value,
					}),
				);
				map.set(field.id, options);
			}
		});
		return map;
	}, [customFields]);

	const groupedFields = useMemo(() => {
		const fields = customFields;
		return fields.reduce<Record<string, CustomField[]>>((acc, field) => {
			const stepName = field.step_name;
			if (!acc[stepName]) {
				acc[stepName] = [];
			}
			acc[stepName].push(field);
			return acc;
		}, {});
	}, [customFields]);

	if (caseError) {
		toast.error("Error fetching case data");
		navigate("/cases");
	}

	const renderContent = () => {
		const sortedSections = Object.entries(groupedFields).sort(
			([a], [b]) => {
				const aMin = Math.min(
					...groupedFields[a].map((f) => f.sequence_number),
				);
				const bMin = Math.min(
					...groupedFields[b].map((f) => f.sequence_number),
				);
				return aMin - bMin;
			},
		);

		if (editingEnabled) {
			return (
				<FormProvider {...form}>
					{sortedSections.map(([stepName, fields]) => (
						<StepSection
							key={stepName}
							title={stepName}
							fields={fields}
							editingEnabled={editingEnabled}
							editableFieldIds={editableFieldIds}
							getSaveStatus={getSaveStatus}
							getOriginalValue={getOriginalValue}
							onEditComplete={handleEditComplete}
							dropdownOptionsMap={dropdownOptionsMap}
						/>
					))}
				</FormProvider>
			);
		}

		return sortedSections.map(([stepName, fields]) => (
			<ReadOnlyStepSection
				key={stepName}
				title={stepName}
				fields={fields}
			/>
		));
	};

	const hasApplicantFields = customFields.some(
		(f) => getCustomFieldSource(f)?.type === "applicant",
	);
	const hasInternalFields = customFields.some(
		(f) => getCustomFieldSource(f)?.type === "internal",
	);

	return (
		<div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
			<div className="col-span-1 space-y-4 lg:col-span-7">
				{renderContent()}
				<InternalFieldFooter
					hasApplicantFields={hasApplicantFields}
					hasInternalFields={hasInternalFields}
				/>
			</div>
			<div className="flex flex-col col-span-1 gap-4 lg:col-span-5">
				<CaseProgressOrScore caseId={caseId} caseData={caseData} />
			</div>
		</div>
	);
};
