import React from "react";
import { EditableField } from "@/components/EditableField";
import { CardListItem, ExternalLink } from "../../../components";
import type { FieldSource } from "../../../components/fieldSource.types";
import { validateWebsite } from "../utils/WebsiteTab";

import { VALUE_NOT_AVAILABLE } from "@/constants";
import { formatUrl } from "@/helpers";

interface WebsiteUrlItemProps {
	url: string;
	fieldSource?: FieldSource;
	canEdit: boolean;
	originalValue: string;
	saveStatus: "idle" | "saving" | "saved" | "error";
	onEditComplete: (
		fieldKey: string,
		originalValue: string,
		newValue: string,
	) => void;
	suggestionGroups?: any[];
}

export const WebsiteUrlItem: React.FC<WebsiteUrlItemProps> = ({
	url,
	fieldSource,
	canEdit,
	originalValue,
	saveStatus,
	onEditComplete,
	suggestionGroups,
}) => {
	if (canEdit) {
		return (
			<CardListItem
				label="Website"
				fieldSource={fieldSource}
				value={
					<EditableField
						name="website"
						inputType="text"
						onEditComplete={onEditComplete}
						editingEnabled={canEdit}
						saveStatus={saveStatus}
						placeholder="Enter website URL"
						label="Website"
						suggestionGroups={suggestionGroups}
						formatDisplayValue={(val: string) => {
							if (!val || val === VALUE_NOT_AVAILABLE) {
								return VALUE_NOT_AVAILABLE;
							}
							return formatUrl(val);
						}}
						originalValue={originalValue}
						rules={{
							validate: (value: string) => {
								const error = validateWebsite(value);
								return error ?? true;
							},
						}}
					/>
				}
			/>
		);
	}

	return (
		<CardListItem
			label="Website"
			fieldSource={fieldSource}
			value={
				url !== "N/A" && url !== VALUE_NOT_AVAILABLE ? (
					<ExternalLink href={url}>
						{url.length > 50 ? `${url.slice(0, 50)}...` : url}
					</ExternalLink>
				) : (
					<span className="ml-auto text-sm">N/A</span>
				)
			}
		/>
	);
};
