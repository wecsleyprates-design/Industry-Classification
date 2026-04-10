/**
 * Types for attribute catalog operations
 */
import { Workflows } from "@joinworth/types";

export const ATTRIBUTE_DATA_TYPES = Workflows.Attributes.ATTRIBUTE_DATA_TYPES;
export const ATTRIBUTE_SOURCES = Workflows.Attributes.ATTRIBUTE_SOURCES;

export type AttributeDataType = (typeof ATTRIBUTE_DATA_TYPES)[keyof typeof ATTRIBUTE_DATA_TYPES];
export type AttributeSource = (typeof ATTRIBUTE_SOURCES)[keyof typeof ATTRIBUTE_SOURCES];

export interface AttributeCatalogRecord {
	id: string;
	context: string;
	source: AttributeSource;
	path: string;
	label: string | null;
	data_type: AttributeDataType;
	description: string | null;
	active: boolean;
	validation_regex: string | null;
	created_at: Date;
	updated_at: Date;
}

export type AttributeCatalogRecordForListing = Pick<
	AttributeCatalogRecord,
	"context" | "source" | "path" | "label" | "data_type" | "description" | "validation_regex"
>;
