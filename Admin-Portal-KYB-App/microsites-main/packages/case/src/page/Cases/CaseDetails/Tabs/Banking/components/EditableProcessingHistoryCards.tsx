import React from "react";
import type { SuggestionGroup } from "@/components/EditableField/types";
import type { FieldSourceMap } from "../hooks/useProcessingHistoryEditState";
import { useProcessingHistoryFieldRenderer } from "../hooks/useProcessingHistoryFieldRenderer";
import type { ProcessingHistoryFieldKey } from "../schemas/processingHistorySchema";
import { PointOfSaleEditProvider } from "./PointOfSaleVolumeGroupField";

import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";

interface EditableProcessingHistoryCardProps {
	title: string;
	editingEnabled: boolean;
	getSaveStatus: (
		fieldKey: ProcessingHistoryFieldKey,
	) => "idle" | "saving" | "saved" | "error";
	getOriginalValue: (
		fieldKey: ProcessingHistoryFieldKey,
	) => string | string[];
	onEditComplete: (
		fieldKey: ProcessingHistoryFieldKey,
		originalValue: string | string[],
		newValue: string | string[],
	) => void;
	suggestions?: SuggestionGroup[];
	fields: Array<{ label: string; field: React.ReactNode }>;
}

const EditableProcessingHistoryCard: React.FC<
	EditableProcessingHistoryCardProps
> = ({ title, fields }) => {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base font-medium">{title}</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="space-y-0">
					{fields.map((fieldRow, index) => (
						<div
							key={index}
							className="flex items-center justify-between py-4 border-t border-gray-100"
						>
							<span className="text-sm text-gray-600">
								{fieldRow.label}
							</span>
							{fieldRow.field}
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
};

interface EditableProcessingVolumeCardProps {
	title: string;
	editingEnabled: boolean;
	getSaveStatus: (
		fieldKey: ProcessingHistoryFieldKey,
	) => "idle" | "saving" | "saved" | "error";
	getOriginalValue: (
		fieldKey: ProcessingHistoryFieldKey,
	) => string | string[];
	onEditComplete: (
		fieldKey: ProcessingHistoryFieldKey,
		originalValue: string | string[],
		newValue: string | string[],
	) => void;
	suggestions?: SuggestionGroup[];
	fieldSourceMap?: FieldSourceMap;
}

export const EditableProcessingVolumeCard: React.FC<
	EditableProcessingVolumeCardProps
> = ({
	title,
	editingEnabled,
	getSaveStatus,
	getOriginalValue,
	onEditComplete,
	suggestions,
	fieldSourceMap,
}) => {
	const { generalFields, cardFields, amexFields } =
		useProcessingHistoryFieldRenderer({
			editingEnabled,
			getSaveStatus,
			getOriginalValue,
			onEditComplete,
			suggestions,
			fieldSourceMap,
		});

	const fields =
		title === "General"
			? generalFields
			: title === "Visa/Mastercard/Discover"
				? cardFields
				: amexFields;

	return (
		<EditableProcessingHistoryCard
			title={title}
			editingEnabled={editingEnabled}
			getSaveStatus={getSaveStatus}
			getOriginalValue={getOriginalValue}
			onEditComplete={onEditComplete}
			suggestions={suggestions}
			fields={fields}
		/>
	);
};

interface EditablePointOfSaleVolumeCardProps {
	editingEnabled: boolean;
	getSaveStatus: (
		fieldKey: ProcessingHistoryFieldKey,
	) => "idle" | "saving" | "saved" | "error";
	getOriginalValue: (
		fieldKey: ProcessingHistoryFieldKey,
	) => string | string[];
	onEditComplete: (
		fieldKey: ProcessingHistoryFieldKey,
		originalValue: string | string[],
		newValue: string | string[],
	) => void;
	suggestions?: SuggestionGroup[];
	fieldSourceMap?: FieldSourceMap;
}

export const EditablePointOfSaleVolumeCard: React.FC<
	EditablePointOfSaleVolumeCardProps
> = ({
	editingEnabled,
	getSaveStatus,
	getOriginalValue,
	onEditComplete,
	suggestions,
	fieldSourceMap,
}) => {
	const { pointOfSaleFields } = useProcessingHistoryFieldRenderer({
		editingEnabled,
		getSaveStatus,
		getOriginalValue,
		onEditComplete,
		suggestions,
		fieldSourceMap,
	});

	return (
		<PointOfSaleEditProvider
			editingEnabled={editingEnabled}
			getOriginalValue={getOriginalValue}
			onEditComplete={onEditComplete}
		>
			<EditableProcessingHistoryCard
				title="Point of Sale Volume"
				editingEnabled={editingEnabled}
				getSaveStatus={getSaveStatus}
				getOriginalValue={getOriginalValue}
				onEditComplete={onEditComplete}
				suggestions={suggestions}
				fields={pointOfSaleFields}
			/>
		</PointOfSaleEditProvider>
	);
};

interface EditableSeasonalDataCardProps {
	editingEnabled: boolean;
	getSaveStatus: (
		fieldKey: ProcessingHistoryFieldKey,
	) => "idle" | "saving" | "saved" | "error";
	getOriginalValue: (
		fieldKey: ProcessingHistoryFieldKey,
	) => string | string[];
	onEditComplete: (
		fieldKey: ProcessingHistoryFieldKey,
		originalValue: string | string[],
		newValue: string | string[],
	) => void;
	suggestions?: SuggestionGroup[];
	fieldSourceMap?: FieldSourceMap;
}

export const EditableSeasonalDataCard: React.FC<
	EditableSeasonalDataCardProps
> = ({
	editingEnabled,
	getSaveStatus,
	getOriginalValue,
	onEditComplete,
	suggestions,
	fieldSourceMap,
}) => {
	const { seasonalFields } = useProcessingHistoryFieldRenderer({
		editingEnabled,
		getSaveStatus,
		getOriginalValue,
		onEditComplete,
		suggestions,
		fieldSourceMap,
	});

	return (
		<EditableProcessingHistoryCard
			title="Seasonal"
			editingEnabled={editingEnabled}
			getSaveStatus={getSaveStatus}
			getOriginalValue={getOriginalValue}
			onEditComplete={onEditComplete}
			suggestions={suggestions}
			fields={seasonalFields}
		/>
	);
};
