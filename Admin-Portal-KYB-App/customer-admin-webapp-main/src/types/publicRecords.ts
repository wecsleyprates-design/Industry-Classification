export interface PublicRecordsResponse {
	status: string;
	message: string;
	data: PublicRecordsResponseData;
}

export interface PublicRecordsResponseData {
	public_records: PublicRecords;
}

export interface PublicRecords {
	id: string | null;
	business_integration_task_id: string | null;
	number_of_business_liens: string | null;
	most_recent_business_lien_filing_date: string | null;
	most_recent_business_lien_status: string | null;
	number_of_bankruptcies: string | null;
	most_recent_bankruptcy_filing_date: string | null;
	number_of_judgement_fillings: string | null;
	most_recent_judgement_filling_date: string | null;
	corporate_filing_business_name: string | null;
	corporate_filing_filling_date: string | null;
	corporate_filing_incorporation_state: string | null;
	corporate_filing_corporation_type: string | null;
	corporate_filing_resgistration_type: string | null;
	corporate_filing_secretary_of_state_status: string | null;
	corporate_filing_secretary_of_state_status_date: string | null;
	created_at: Date;
	updated_at: Date;
	monthly_rating_date: Date;
	official_website: string | null;
	reviews: any[];
	review_statistics: Record<string, number>;
	complaint_statistics: Record<string, number>;
	additional_records: AdditionalRecords;
	average_rating: number;
}

export interface AdditionalRecords {
	minority_owned_enterprise: string;
	woman_owned_enterprise: string;
	veteran_owned_enterprise: string;
	number_of_employees: string;
}

export interface AdverseMediaResponse {
	status: string;
	message: string;
	data: AdverseMediaResponseData;
}

export interface AdverseMediaResponseData {
	id: string;
	business_id: string;
	business_integration_task_id: string;
	total_risk_count: number;
	high_risk_count: number;
	medium_risk_count: number;
	low_risk_count: number;
	average_risk_score: string;
	created_at: Date;
	updated_at: Date;
	articles: AdverseMediaResponseDataArticle[];
}

export interface AdverseMediaResponseDataArticle {
	id: string;
	adverse_media_id: string;
	business_id: string;
	title: string;
	link: string;
	date: Date;
	source: string;
	keywords_score: number;
	negative_sentiment_score: number;
	entity_focus_score: number;
	final_score: number;
	risk_level: "LOW" | "MEDIUM" | "HIGH";
	risk_description: string;
	media_type?: "business" | string; // "business" or individual name (any string since we don't know specific names)
	created_at: Date;
	updated_at: Date;
}
