export interface TaxFiling {
	year: string;
	quarter?: string;
	formType: string;
	details: TaxFilingDetail[];
	documents?: TaxFilingDocument[];
}

import type { FieldSource } from "../../../components/fieldSource.types";

export interface TaxFilingDetail {
	label: string;
	value: string | number;
	fieldSource?: FieldSource;
}

export interface TaxFilingDocument {
	fileName: string;
	signedUrl: string;
}
