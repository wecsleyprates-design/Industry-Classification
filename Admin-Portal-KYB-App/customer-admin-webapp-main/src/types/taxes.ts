export interface TaxesResponseType {
	status: string;
	message: string;
	data: TaxesData;
}

export interface TaxesData {
	annual_data: AnnualData[];
	is_consent_provided: boolean;
	irs_status: string;
	consent_file?: { fileName: string; signedRequest: string; url: string };
	guest_owner_edits: string[];
}

export interface AnnualData {
	period: number;
	business_type: string;
	total_sales: number;
	total_compensation: number;
	total_wages: number;
	irs_balance: number;
	lien_balance: number;
	total_income: number;
	cost_of_goods_sold: number;
	quarterlyData: QuarterlyData[];
	metadata: {
		ocr_document: Array<{ file_name: string; file_path: string }>;
	};
}

export interface QuarterlyData {
	periodYear: number;
	periodMonth: number;
	form: string;
	form_type: string;
	interest: string;
	interest_date: string;
	penalty: string;
	penalty_date: string;
	filed_date: string;
	balance: string;
	tax_period_ending_date: string;
	amount_filed: string;
}
