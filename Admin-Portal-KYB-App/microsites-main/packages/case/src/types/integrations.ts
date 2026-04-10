import type { ApiResponse } from "./api";
import type { Owner } from "./case";

import type { BadgeProps } from "@/ui/badge";

export interface IntegrationResponseType {
	status: string;
	message: string;
	data: Data[];
}

export interface Data {
	category: string;
	integrations: Integration[];
}

export interface Integration {
	id: number;
	status: string;
	name: string;
}

export interface BusinessWebsiteResponse {
	status: string;
	message: string;
	data: BusinessWebsiteData;
}

export interface BusinessWebsiteData {
	id: string;
	url: string;
	error: null;
	pages: Page[];
	title: string;
	domain: Domain;
	object: string;
	parked: boolean;
	people: null;
	status: string;
	addresses: any[];
	created_at: Date;
	updated_at: Date;
	business_id: string;
	description: string;
	phone_numbers: any[];
	http_status_code: null;
	business_name_match: boolean;
}

export interface Domain {
	domain: string;
	domain_id: string;
	registrar: Registrar;
	creation_date: string;
	expiration_date: string;
}

export interface Registrar {
	url: string;
	name: string;
	organization: string;
}

export interface Page {
	url: string;
	category: string;
	screenshot_url: string;
	text: string;
}

export interface IncomeStatementByDate {
	year: number;
	start_date: string;
	end_date: string;
	income_statement: IncomeStatement;
}

export interface IncomeStatementUpdatedResponse {
	status: string;
	message: string;
	data: IncomeStatementByDate[];
}

export interface CostOfGoodsSoldCategories {
	"Cost of Goods Sold": number;
	"Cost of Goods Sold > Cost of Goods Sold": number;
}

export interface ExpenseCategories {
	Advertising: number;
	Automobile: number;
	"Automobile > Fuel": number;
	"Automobile > Automobile": number;
	"Equipment Rental": number;
	Insurance: number;
	"Job Expenses": number;
	"Job Expenses > Job Materials": number;
	"Job Expenses > Job Materials > Decks and Patios": number;
	"Job Expenses > Job Materials > Plants and Soil": number;
	"Job Expenses > Job Materials > Sprinklers and Drip Systems": number;
	"Job Expenses > Job Expenses": number;
	"Legal & Professional Fees": number;
	"Legal & Professional Fees > Accounting": number;
	"Legal & Professional Fees > Lawyer": number;
	"Legal & Professional Fees > Legal & Professional Fees": number;
	"Legal & Professional Fees > Bookkeeper": number;
	"Maintenance and Repair": number;
	"Maintenance and Repair > Equipment Repairs": number;
	"Maintenance and Repair > Maintenance and Repair": number;
	"Meals and Entertainment": number;
	"Office Expenses": number;
	"Rent or Lease": number;
	Utilities: number;
	"Utilities > Gas and Electric": number;
	"Utilities > Telephone": number;
}

export interface IncomeStatement {
	revenue: Record<string, number>;
	cost_of_goods_sold: Partial<CostOfGoodsSoldCategories>;
	expenses: Partial<ExpenseCategories>;
	total_revenue: number;
	total_cost_of_goods_sold: number;
	total_expenses: number;
	gross_profit: number;
	net_income: number;
}

export interface BalanceSheetUpdatedResponse {
	status: string;
	message: string;
	data: Record<string, BalanceSheetUpdatedResponseData>;
}

export interface BalanceSheetUpdatedResponseData {
	end_date: Date;
	assets: Assets;
	liabilities_and_equity: LiabilitiesAndEquity;
}

export interface Assets {
	checking_savings: BalanceSheetUpdatedResponseDataObject[];
	other_current_assets: BalanceSheetUpdatedResponseDataObject[];
	fixed_assets: BalanceSheetUpdatedResponseDataObject[];
	deposit_assets: BalanceSheetUpdatedResponseDataObject[];
	total_assets: number;
	total_checking_savings: number;
	total_other_current_assets: number;
	total_fixed_assets: number;
	total_deposit_assets: number;
}

export interface BalanceSheetUpdatedResponseDataObject {
	name: string;
	value: number;
}

export interface LiabilitiesAndEquity {
	liabilities: Liabilities;
	equity: BalanceSheetUpdatedResponseDataObject[];
	total_current_liabilities: number;
	total_long_term_liabilities: number;
	total_liabilities: number;
	total_equity: number;
	total_liabilities_and_equity: number;
}

export interface Liabilities {
	current_liabilities: BalanceSheetUpdatedResponseDataObject[];
	long_term_liabilities: BalanceSheetUpdatedResponseDataObject[];
}

export interface TransactionResponse {
	status: string;
	message: string;
	data: TransactionResponseData;
}

export interface TransactionResponseData {
	records: Transaction[];
	total_items: number;
	total_pages: number;
}
export interface Transaction {
	date: string;
	description: string;
	currency: string;
	balance: number;
	transaction?: string;
}

export interface EquifaxCreditReportDataResponse {
	status: string;
	message: string;
	data: EquifaxCreditReportDataResponseData;
}

export type EquifaxCreditReportDataResponseData = Record<
	string,
	EquifaxCreditReportDataResponseObject
>;

export interface EquifaxCreditReportDataResponseObject {
	fileName: string;
	signedRequest: string;
	url: string;
}

interface BusinessOwnerScore {
	score_id: string;
	task_id: string;
	owner_id: string;
	as_of: string;
	score: number;
	created_at: string;
	updated_at: string;
}

export type GetCustomerBusinessOwnerScoresResponse = ApiResponse<
	Record<Owner["id"], BusinessOwnerScore[]>
>;

export type GetProcessingStatementsResponse = ApiResponse<
	ProcessingHistoryData[]
>;

export interface ProcessingHistoryData {
	id: string;
	case_id: string;
	ocr_document_id: string | null;
	american_express_data: SectionData;
	card_data: SectionData;
	point_of_sale_data: PointOfSaleData;
	created_at: Date;
	created_by: string;
	updated_at: Date;
	updated_by: string;
	file_name: string;
	file_path: string;
	general_data: GeneralData;
	seasonal_data: SeasonalData;
	file: File;
	guest_owner_edits?: string[];
}
export interface SectionData {
	desired_limit?: number;
	monthly_volume?: number;
	high_ticket_size?: number;
	average_ticket_size?: number;
	annual_volume?: number;
	guest_owner_edits?: string[];
}

export interface GeneralData extends SectionData {
	explanation_of_high_ticket?: string;
	monthly_occurrence_of_high_ticket?: number;
}

export interface PointOfSaleData {
	e_commerce?: number;
	typed_cards?: number;
	swiped_cards?: number;
	mail_telephone?: number;
	guest_owner_edits?: string[];
}

export interface SeasonalData {
	high_volume_months?: string[];
	explanation_of_high_volume_months?: string;
	guest_owner_edits?: string[];
}

export interface FactBusinessDetailsResponseType {
	business_addresses_submitted: FactResponse<PrimaryAddressValue[]>;
	business_addresses_submitted_strings: FactResponse<
		Array<{ address: string; is_primary: boolean }>
	>;
	business_names_submitted: FactResponse<string[]>;
	business_name: FactResponse<string>;
	business_phone: FactResponse<string>;
	dba: FactResponse<string[] | string>;
	industry: FactResponse<{ id: number; name: string; sector_code: string }>;
	mailing_address: FactResponse<PrimaryAddressValue[]>;
	mailing_address_strings: FactResponse<string[]>;
	mcc_code: FactResponse<number>;
	mcc_description: FactResponse<string>;
	naics_code: FactResponse<number>;
	naics_description: FactResponse<string>;
	names: FactResponse<string[]>;
	num_employees: FactResponse<number>;
	primary_address: FactResponse<PrimaryAddressValue>;
	primary_address_string: FactResponse<string>;
	primary_city: FactResponse<string>;
	website: FactResponse<string>;
	year_established: FactResponse<number>;
	guest_owner_edits?: string[];
}

export interface FactsBusinessKybResponseType {
	address_match: FactResponse<string>;
	address_match_boolean: FactResponse<boolean>;
	address_registered_agent: FactResponse<MatchValue>;
	address_verification: FactResponse<AddressesValue>;
	address_verification_boolean: FactResponse<boolean>;
	addresses: FactResponse<string[]>;
	addresses_deliverable: FactResponse<string[]>;
	addresses_found: FactResponse<string[]>;
	corporation: FactResponse<string>;
	countries: FactResponse<string[]>;
	email: FactResponse<string | null>;
	formation_date: FactResponse<string>;
	formation_state: FactResponse<string>;
	kyb_submitted: FactResponse<boolean>;
	legal_name: FactResponse<string>;
	minority_owned: FactResponse<boolean>;
	name_match: FactResponse<MatchValue>;
	name_match_boolean: FactResponse<boolean>;
	names_submitted: FactResponse<NamesSubmittedValue[]>;
	dba_found: FactResponse<string[]>;
	names_found: FactResponse<string[]>;
	npi: FactResponse<string>;
	phone_found: FactResponse<string[]>;
	people: FactResponse<PeopleObjectValue[]>;
	primary_address: FactResponse<PrimaryAddressValue>;
	sos_active: FactResponse<boolean>;
	sos_filings: FactResponse<KYBSosFilingValue[]>;
	sos_match: FactResponse<string>;
	sos_match_boolean: FactResponse<boolean>;
	tin: FactResponse<string>;
	tin_match: FactResponse<MatchValue>;
	tin_match_boolean: FactResponse<boolean>;
	veteran_owned: FactResponse<boolean>;
	watchlist: FactResponse<WatchlistValue>;
	watchlist_hits: FactResponse<string>;
	woman_owned: FactResponse<boolean>;
	year_established: FactResponse<number>;
	guest_owner_edits?: string[];
}
export type FactsBusinessKybResponse = FactsBusinessKybResponseType;

export interface FactsBusinessFinancialsResponseType {
	revenue?: FactResponse<number>;
	revenue_confidence?: FactResponse<number>;
	net_income?: FactResponse<number>;
	revenue_equally_weighted_average?: FactResponse<number>;
	revenue_all_sources?: FactResponse<number>;
	guest_owner_edits?: string[];
}

interface FactResponse<T = any> {
	name: string;
	value: T | undefined;
	dependencies?: string[];
	confidence?: number;
	category?: string;
	resolved?: string; // ISO date string
	ruleApplied?: {
		name: string;
		description: string;
		actions?: string[];
	};
	isDefault?: boolean;
	alternatives?: Array<{
		value: T;
		source: string | number;
	}>;
	weight?: number;
	description?: string;
	"source.platformId"?: number;
	source?: {
		confidence?: number;
		name?: string; // Only included for admin users
	};
}

export interface AddressesValue {
	addresses: string[];
	baseAddresses?: string[];
	label: string;
	sublabel: string;
	message: string;
	status: "success" | "failure" | "warning" | undefined;
}
export interface PeopleObjectValue {
	name: string;
	titles: string[];
	submitted?: boolean;
	source?: string[];
	jurisdictions?: string[];
}

export interface PeopleObjectValueSource {
	id: string;
	type: string;
	metadata: PeopleObjectValueSourceMetadata;
}

export interface PeopleObjectValueSourceMetadata {
	state: string;
	status: string;
	file_number: string;
	jurisdiction: string;
}

export interface MatchValue {
	status: string;
	message: string;
	sublabel: string;
}

export interface NamesSubmittedValue {
	name: string;
	submitted: boolean;
}

export interface AddressValue {
	line_1: string | null;
	apartment: string | null;
	city: string | null;
	state: string | null;
	country?: string | null;
	postal_code: string | null;
	mobile?: null;
	is_primary: boolean;
}

export type PrimaryAddressValue = AddressValue;

export interface KYBSosFilingValue {
	id: string;
	filing_name: string;
	state: string;
	filing_date: Date;
	entity_type: string;
	url: string;
	active: boolean;
	non_profit: boolean | undefined;
	foreign_domestic: "foreign" | "domestic" | undefined;
	officers: PeopleObjectValue[];
}

export interface SosFilingsValue {
	id: string;
	business_entity_verification_id: string;
	created_at: Date;
	updated_at: null;
	external_id: string;
	name: string;
	status: string;
	sub_status: null | string;
	status_details: null | string;
	jurisdiction: string;
	entity_type: string;
	file_number: string;
	full_addresses: string[];
	registration_date: Date;
	registration_state: string;
	url: string;
}

export interface WatchlistValue {
	metadata: Metadatum[];
	message: string;
}

export interface WatchlistValueMetadatum {
	id: string;
	type: string;
	metadata: Metadata;
	url?: string | null;
	list_url?: string | null;
	agency_information_url?: string | null;
	agency_list_url?: string | null;
	list_country?: string | null;
	list_region?: string | null;
	entity_aliases?: string[];
	addresses?: Array<{ full_address: string }>;
	listed_at?: string | null;
	categories?: string[];
	score?: number;
}

export type Metadatum = WatchlistValueMetadatum;

export interface Metadata {
	abbr: string;
	title: string;
	agency: string;
	agency_abbr: string;
	entity_name: string;
}

export interface AddressDeliverableFormat {
	full_address: string;
	deliverable: boolean;
}

export interface PublicRecordsData {
	public_records: {
		id: string;
		business_integration_task_id: string;
		number_of_business_liens: string;
		most_recent_business_lien_filing_date: string | null;
		most_recent_business_lien_status: string | null;
		number_of_bankruptcies: string;
		most_recent_bankruptcy_filing_date: string | null;
		number_of_judgement_fillings: string;
		most_recent_judgement_filling_date: string | null;
		corporate_filing_business_name: string | null;
		corporate_filing_filling_date: string | null;
		corporate_filing_incorporation_state: string | null;
		corporate_filing_corporation_type: string | null;
		corporate_filing_resgistration_type: string | null;
		corporate_filing_secretary_of_state_status: string | null;
		corporate_filing_secretary_of_state_status_date: string | null;
		average_rating: string;
		created_at: string;
		updated_at: string;
		monthly_rating: string;
		monthly_rating_date: string;
		official_website: string | null;
		reviews: PublicRecordsReview[];
		review_statistics: PublicRecordsReviewStatistics;
		complaint_statistics: PublicRecordsComplaintStatistics;
		additional_records: PublicRecordsAdditionalRecords;
	};
}

export interface PublicRecordsReview {
	source: string;
	count: number;
	percentage: string;
}

export interface PublicRecordsReviewStatistics {
	count_of_total_reviewers_all_time: number;
	count_of_duplicate_reviewers_all_time: number;
	min_rating_all_time: number;
	median_rating_all_time: number;
	max_rating_all_time: number;
	review_count: number;
	standard_deviation_of_rating_all_time: number;
	variance_of_rating_all_time: number;
	count_of_0_or_1_star_ratings_all_time: number;
	count_of_2_star_ratings_all_time: number;
	count_of_3_star_ratings_all_time: number;
	count_of_4_star_ratings_all_time: number;
	count_of_5_star_ratings_all_time: number;
	percentage_of_0_or_1_star_ratings_all_time: number;
	percentage_of_2_star_ratings_all_time: number;
	percentage_of_3_star_ratings_all_time: number;
	percentage_of_4_star_ratings_all_time: number;
	percentage_of_5_star_ratings_all_time: number;
	count_of_reviews_containing_alert_words_all_time: number;
	percentage_of_reviews_containing_alert_words_all_time: number;
}

export interface PublicRecordsComplaintStatistics {
	count_of_total_reviewers_all_time: number | null;
	count_of_complaints_all_time: number | null;
	count_of_consumer_financial_protection_bureau_complaints_all_time:
		| number
		| null;
	percentage_of_complaints_containing_alert_words_all_time: number | null;
	count_of_federal_trade_commission_complaints_all_time: number | null;
	count_of_answered_resolved_status_all_time: number | null;
	percentage_of_answered_resolved_status_all_time: number | null;
	count_of_resolved_resolved_status_all_time: number | null;
	percentage_of_resolved_resolved_status_all_time: number | null;
	count_of_unanswered_resolved_status_all_time: number | null;
	percentage_of_unanswered_resolved_status_all_time: number | null;
	count_of_unresolved_resolved_status_all_time: number | null;
	percentage_of_unresolved_resolved_status_all_time: number | null;
	count_of_other_resolved_status_all_time: number | null;
	percentage_of_other_resolved_status_all_time: number | null;
}

export interface PublicRecordsAdditionalRecords {
	minority_owned_enterprise: string;
	woman_owned_enterprise: string;
	veteran_owned_enterprise: string;
	number_of_employees: string;
}

export interface ReviewSource {
	name: string;
	count: number;
	percentage: number;
}

export interface ReviewStats {
	sources: ReviewSource[];
	averageRating: number;
	totalReviews: number;
	ratingBreakdown: Record<
		number,
		{
			count: number;
			percentage: number;
		}
	>;
	insights: {
		totalReviewers: number;
		duplicateReviews: number;
		alertWordReviews: number;
		minRating: number;
		medianRating: number;
		maxRating: number;
	};
}

export interface GetAllDocumentsResponse {
	status: string;
	message: string;
	data: GetAllDocumentsResponseData;
}

export type GetAllDocumentsResponseData = Record<
	string,
	GetAllDocumentsResponseDataObject[]
>;

export interface GetAllDocumentsResponseDataObject {
	file_name: string;
	file_path: string;
	file: File;
	ocr_document_id?: string;
}

export interface File {
	fileName: string;
	signedRequest: string;
	url: string;
	filePath?: string;
}

export interface BusinessNpiResponse {
	status: string;
	message: string;
	data: BusinessNpiData;
}

export interface BusinessNpiData {
	submitted_npi: string;
	business_id: string;
	employer_identification_number: string;
	business_integration_task_id: string;
	is_sole_proprietor?: boolean;
	created_at?: string;
	updated_at?: string;
	provider_gender_code?: string;
	provider_first_name?: string;
	provider_middle_name?: string;
	provider_last_name?: string;
	provider_organization_name?: string;
	provider_credential_text?: string;
	metadata?: NpiMetadata;
	guest_owner_edits?: string[];
	is_matched: boolean;
}

export interface NpiMetadata {
	["entity type code"]?: number;
	["provider license number state code_1"]?: string;
	["provider license number_1"]?: string;
	["healthcare provider taxonomy code_1"]?: string;
	["provider name prefix text"]?: string;
}

export interface NpiDoctorsResponse {
	status: string;
	message: string;
	data: NpiDoctor[];
}

export interface NpiDoctor {
	name: string;
	npi_id: string;
	specialty: string;
	years_of_experience: string | null;
	doctor_licenses: NpiDoctorLicense[];
	reviews: Record<string, NpiDoctorReviewSource>;
}

export interface NpiDoctorLicense {
	id: string;
	name: string;
	lender: string;
	npi_id: string;
	license_number: string;
	license_taxonomy_code: string;
	primary_taxonomy_switch: "Y" | "N";
	license_number_state_code: string;
	updated_at: string;
}

export interface NpiDoctorReviewSource {
	source_url: string;
	doctor_reviews: unknown[];
}

export type BJLStatus =
	| "active"
	| "closed"
	| "pending"
	| "unknown"
	| "withdrawn"
	| null;

export type Judgement = {
	count: number | null;
	most_recent: Date | null;
	most_recent_status: BJLStatus;
	most_recent_amount: number | null;
	total_judgement_amount: number | null;
};

export type Lien = {
	count: number | null;
	most_recent: Date | null;
	most_recent_status: BJLStatus;
	most_recent_amount: number | null;
	total_open_lien_amount: number | null;
};

export type Bankruptcy = {
	count: number | null;
	most_recent: Date | null;
	most_recent_status: BJLStatus;
};

export interface GetFactsBusinessBJLResponse {
	num_liens: {
		name: "num_liens";
		value: number | null;
		alternatives: Array<{
			value: number | null;
			source: number;
			confidence: number;
		}>;
	};
	num_judgements: {
		name: "num_judgements";
		value: number | null;
		alternatives: Array<{
			value: number | null;
			source: number;
			confidence: number;
		}>;
	};
	num_bankruptcies: {
		name: "num_bankruptcies";
		value: number | null;
		alternatives: Array<{
			value: number | null;
			source: number;
			confidence: number;
		}>;
	};
	bankruptcies: {
		name: "bankruptcies";
		value: Bankruptcy | null;
		alternatives: Array<{
			value: Bankruptcy | null;
			source: number;
			confidence: number;
		}>;
	};
	liens: {
		name: "liens";
		value: Lien | null;
		alternatives: Array<{
			value: Lien | null;
			source: number;
			confidence: number;
		}>;
	};
	judgements: {
		name: "judgements";
		value: Judgement | null;
		alternatives: Array<{
			value: Judgement | null;
			source: number;
			confidence: number;
		}>;
	};
}

export interface GoogleProfileResponse {
	business_match: "Match Found" | "Not Found" | "Partial Match";
	google_profile: GoogleProfile;
	address_match: string;
	address_similarity_score: number;
}

export interface GoogleProfile {
	business_name: string;
	address: string;
	phone_number: string;
	website: string;
	rating: number;
	reviews: number;
	thumbnail: string;
	gps_coordinates: GpsCoordinates;
	google_search_link: string;
}

export interface GpsCoordinates {
	latitude: number;
	longitude: number;
}

export interface IntegrationSetting {
	status: "ACTIVE" | "INACTIVE";
	code: string;
	label: string;
	description: string;
	mode: "SANDBOX" | "PRODUCTION" | "MOCK";
	options: Array<"PRODUCTION" | "SANDBOX" | "MOCK" | "DISABLE">;
	isEnabled?: boolean;
}

export interface CustomerIntegrationSettingResponseDataSettings {
	[key: string]: IntegrationSetting | undefined;
	bjl?: IntegrationSetting;
	equifax?: IntegrationSetting;
	gverify?: IntegrationSetting;
	gauthenticate?: IntegrationSetting;
	website?: IntegrationSetting;
	npi?: IntegrationSetting;
	identity_verification?: IntegrationSetting;
	adverse_media?: IntegrationSetting;
	processor_orchestration?: IntegrationSetting;
}

export interface CustomerIntegrationSettingsResponse {
	status: string;
	message: string;
	data: {
		customer_id: string;
		settings: CustomerIntegrationSettingResponseDataSettings;
	};
}

export interface MatchResultResponse {
	status: string;
	message: string;
	data: MatchResultData;
	metadata?: {
		status: string;
		processing_started_at?: string;
	};
}

export interface MatchResultData {
	icas?: Record<string, { ica: string; isDefault: boolean } | string[]>;
	results?: Record<string, MatchResultItem>;
	errors?: {
		error: MatchError[];
	};
	Errors?: {
		Error: MatchError[];
	};
	terminationInquiryRequest?: {
		merchant?: MerchantDetails;
		acquirerId: string;
	};
	terminationInquiryResponse?: {
		ref: string;
		pageOffset: number;
		possibleMerchantMatches?: PossibleMerchantMatch[];
	};
	summary?: {
		total: number;
		failed: number;
		success: number;
	};
	multi_ica?: boolean;
	timestamp?: string;
	execution_metadata?: Record<string, { cached: boolean; timestamp: string }>;
}

export interface MatchResultItem {
	Errors?: {
		Error: MatchError[];
	};
	errors?: {
		error: MatchError[];
	};
	terminationInquiryRequest?: {
		merchant: MerchantDetails;
		acquirerId: string;
	};
	terminationInquiryResponse?: {
		ref: string;
		pageOffset: number;
		possibleMerchantMatches?: PossibleMerchantMatch[];
	};
}

export interface MatchError {
	Source: string;
	Details: string;
	ReasonCode: string;
	Description: string;
	Recoverable: boolean;
	source?: string;
	details?: string;
}

export interface MerchantDetails {
	name: string;
	urls: string[];
	address: {
		city: string;
		country: string;
		postalCode: string;
		isOtherCity: string;
		addressLineOne: string;
		addressLineTwo: string;
		countrySubdivision: string;
	};
	merchantId: string;
	principals: Principal[];
	phoneNumber: string;
	nationalTaxId: string;
	subMerchantId: string;
	altPhoneNumber: string;
	searchCriteria: {
		minPossibleMatchCount: string;
	};
	merchantCategory: string;
	doingBusinessAsName: string;
	countrySubdivisionTaxId: string;
}

export interface Principal {
	email: string;
	address: {
		city: string;
		country: string;
		postalCode: string;
		isOtherCity: string;
		addressLineOne: string;
		addressLineTwo: string;
		countrySubdivision: string;
	};
	lastName: string;
	firstName: string;
	nationalId: string;
	dateOfBirth: string;
	phoneNumber: string;
	middleInitial: string;
	altPhoneNumber: string;
	driversLicense: {
		number: string;
		country: string;
		countrySubdivision: string;
	};
}

export interface PossibleMerchantMatch {
	terminatedMerchants?: TerminatedMerchant[];
	totalMerchantMatches: number;
}

export interface TerminatedMerchant {
	merchant: MerchantDetails & {
		comments: string | null;
		urlGroups: any[];
		dateClosed: string;
		dateOpened: string;
		reasonCode: string;
		createdDate: string;
		merchRefNum: string;
		reasonCodeDesc: string;
		addedByAcquirerId: string;
	};
	merchantMatch: {
		name: string;
		address: string;
		phoneNumber: string;
		nationalTaxId: string;
		altPhoneNumber: string;
		principalMatches: any[];
		doingBusinessAsName: string;
		countrySubdivisionTaxId: string;
	};
}

export interface ReasonCode {
	title: string;
	description: string;
}

export interface MatchProData {
	totalMatches: number;
	terminatedMerchants: any[];
	reasonCodes: string[];
	acquiringBankBIN: string;
	merchantsName: string;
	dateOfListing?: string;
}

export interface StatusBadge {
	variant: BadgeProps["variant"];
	text: string;
}

export interface MatchProConnectionStatusResponse {
	status: string;
	message: string;
	data: {
		statusConnection: {
			status: string;
			message: string;
			details: {
				statusCode: number;
				expiresAt: string;
				isActive: boolean;
			};
		};
	};
}
export interface createMerchantProfilePayload {
	onboardImmediately: boolean;
	processorId: string;
	platformId: number;
	paymentGroupId: string;
	capabilities: createMerchantProfilePayloadCapabilities;
	businesses: createMerchantProfilePayloadBusiness[];
}

export interface createMerchantProfilePayloadBusiness {
	businessId: string;
	platformId: number;
	banking: createMerchantProfilePayloadBusinessBanking;
}

export interface createMerchantProfilePayloadBusinessBanking {
	bankId: string;
	bankType: string;
}

export interface createMerchantProfilePayloadCapabilities {
	transfers: createMerchantProfilePayloadCapabilitiesCardPayments;
	card_payments: createMerchantProfilePayloadCapabilitiesCardPayments;
	us_bank_account_ach_payments: createMerchantProfilePayloadCapabilitiesCardPayments;
}

export interface createMerchantProfilePayloadCapabilitiesCardPayments {
	requested: boolean;
}

export interface getPaymentProcessorResponse {
	status: string;
	message: string;
	data: getPaymentProcessorResponseDatum[];
}

export interface getPaymentProcessorResponseDatum {
	id: string;
	customer_id: string;
	name: string;
	status: number;
	platform_id: number;
	metadata: getPaymentProcessorResponseDatumMetadata;
	created_at: Date;
	updated_at: Date;
	deleted_at: null;
	created_by: string;
	updated_by: string;
	deleted_by: null;
}

export interface getPaymentProcessorResponseDatumMetadata {
	id: string;
	url: string;
	object: string;
	secret: string;
	status: string;
	created: number;
	livemode: boolean;
	metadata: getPaymentProcessorResponseDatumMetadataMetadata;
	api_version: null;
	application: string;
	description: string;
	enabled_events: string[];
}

export interface getPaymentProcessorResponseDatumMetadataMetadata {
	"worth:customerId": string;
	"worth:processorId": string;
	"worth:processorName": string;
}

export interface MerchantAccountResponse {
	status: string;
	message: string;
	data: MerchantAccountData[];
}

export interface MerchantAccountData {
	id: string;
	platform_id: number;
	business_id: string;
	customer_id: string;
	account_id: string;
	profile_id: string;
	account: MerchantAccountDataAccount;
	created_at: Date;
	updated_at: Date;
	processor_id: string;
	status: number;
	manual_sync_at: null;
	webhook_received_at: Date;
}

export interface MerchantAccountDataAccount {
	id: string;
	type: string;
	email: null;
	object: string;
	company: MerchantAccountDataAccountCompany;
	country: string;
	created: number;
	metadata: Metadata;
	settings: MerchantAccountDataAccountMerchantAccountDataAccountSettings;
	controller: MerchantAccountDataAccountController;
	capabilities: MerchantAccountDataAccountCapabilities;
	requirements: MerchantAccountDataAccountAccountFutureRequirements;
	business_type: string;
	tos_acceptance: MerchantAccountDataAccountAccountTosAcceptance;
	charges_enabled: boolean;
	payouts_enabled: boolean;
	business_profile: MerchantAccountDataAccountBusinessProfile;
	default_currency: string;
	details_submitted: boolean;
	external_accounts: MerchantAccountDataAccountExternalAccounts;
	future_requirements: MerchantAccountDataAccountAccountFutureRequirements;
}

export interface MerchantAccountDataAccountBusinessProfile {
	mcc: string;
	url: null;
	name: string;
	support_url: null;
	support_email: null;
	support_phone: string;
	annual_revenue: null;
	support_address: null;
	product_description: null;
	estimated_worker_count: null;
	minority_owned_business_designation: null;
}

export interface MerchantAccountDataAccountCapabilities {
	transfers: string;
	card_payments: string;
	us_bank_account_ach_payments: string;
}

export interface MerchantAccountDataAccountCompany {
	name: string;
	address: MerchantAccountDataAccountCompanyAddress;
	verification: MerchantAccountDataAccountCompanyVerification;
	owners_provided: boolean;
	tax_id_provided: boolean;
	directors_provided: boolean;
	executives_provided: boolean;
}

export interface MerchantAccountDataAccountCompanyAddress {
	city: string;
	line1: string;
	line2: null;
	state: string;
	country: string;
	postal_code: string;
}

export interface MerchantAccountDataAccountCompanyVerification {
	document: MerchantAccountDataAccountCompanyVerificationDocument;
}

export interface MerchantAccountDataAccountCompanyVerificationDocument {
	back: null;
	front: null;
	details: null;
	details_code: null;
}

export interface MerchantAccountDataAccountController {
	fees: {
		payer: string;
	};
	type: string;
	losses: {
		payments: string;
	};
	is_controller: boolean;
	stripe_dashboard: {
		type: string;
	};
	requirement_collection: string;
}

export interface MerchantAccountDataAccountExternalAccounts {
	url: string;
	data: MerchantAccountDataAccountExternalAccountsExternalAccountsDatum[];
	object: string;
	has_more: boolean;
	total_count: number;
}

export interface MerchantAccountDataAccountExternalAccountsExternalAccountsDatum {
	id: string;
	last4: string;
	object: string;
	status: string;
	account: string;
	country: string;
	currency: string;
	metadata: any;
	bank_name: string;
	fingerprint: string;
	account_type: null;
	requirements: MerchantAccountDataAccountExternalAccountsExternalAccountsDatumDatumFutureRequirements;
	routing_number: string;
	account_holder_name: null;
	account_holder_type: null;
	future_requirements: MerchantAccountDataAccountExternalAccountsExternalAccountsDatumDatumFutureRequirements;
	default_for_currency: boolean;
	available_payout_methods: string[];
}

export interface MerchantAccountDataAccountExternalAccountsExternalAccountsDatumDatumFutureRequirements {
	errors: any[];
	past_due: any[];
	currently_due: any[];
	pending_verification: any[];
}

export interface MerchantAccountDataAccountAccountFutureRequirements {
	errors: any[];
	past_due: string[];
	alternatives: MerchantAccountDataAccountAccountFutureRequirementsAlternative[];
	currently_due: string[];
	eventually_due: string[];
	disabled_reason: null | string;
	current_deadline: null;
	pending_verification: any[];
}

export interface MerchantAccountDataAccountAccountFutureRequirementsAlternative {
	original_fields_due: string[];
	alternative_fields_due: string[];
}

export interface MerchantAccountDataAccountMerchantAccountDataAccountSettings {
	payouts: MerchantAccountDataAccountMerchantAccountDataAccountSettingsPayouts;
	branding: MerchantAccountDataAccountMerchantAccountDataAccountSettingsBranding;
	invoices: MerchantAccountDataAccountMerchantAccountDataAccountSettingsInvoices;
	payments: MerchantAccountDataAccountMerchantAccountDataAccountSettingsPayments;
	dashboard: MerchantAccountDataAccountMerchantAccountDataAccountSettingsDashboard;
	card_issuing: MerchantAccountDataAccountMerchantAccountDataAccountSettingsCardIssuing;
	card_payments: MerchantAccountDataAccountMerchantAccountDataAccountSettingsCardPayments;
	bacs_debit_payments: MerchantAccountDataAccountMerchantAccountDataAccountSettingsBacsDebitPayments;
	sepa_debit_payments: any;
}

export interface MerchantAccountDataAccountMerchantAccountDataAccountSettingsBacsDebitPayments {
	display_name: null;
	service_user_number: null;
}

export interface MerchantAccountDataAccountMerchantAccountDataAccountSettingsBranding {
	icon: null;
	logo: null;
	primary_color: null;
	secondary_color: null;
}

export interface MerchantAccountDataAccountMerchantAccountDataAccountSettingsCardIssuing {
	tos_acceptance: MerchantAccountDataAccountMerchantAccountDataAccountSettingsCardIssuingCardIssuingTosAcceptance;
}

export interface MerchantAccountDataAccountMerchantAccountDataAccountSettingsCardIssuingCardIssuingTosAcceptance {
	ip: null;
	date: null;
}

export interface MerchantAccountDataAccountMerchantAccountDataAccountSettingsCardPayments {
	decline_on: MerchantAccountDataAccountMerchantAccountDataAccountSettingsCardPaymentsDeclineOn;
	statement_descriptor_prefix: string;
	statement_descriptor_prefix_kana: null;
	statement_descriptor_prefix_kanji: null;
}

export interface MerchantAccountDataAccountMerchantAccountDataAccountSettingsCardPaymentsDeclineOn {
	avs_failure: boolean;
	cvc_failure: boolean;
}

export interface MerchantAccountDataAccountMerchantAccountDataAccountSettingsDashboard {
	timezone: string;
	display_name: string;
}

export interface MerchantAccountDataAccountMerchantAccountDataAccountSettingsInvoices {
	default_account_tax_ids: null;
	hosted_payment_method_save: string;
}

export interface MerchantAccountDataAccountMerchantAccountDataAccountSettingsPayments {
	statement_descriptor: string;
	statement_descriptor_kana: null;
	statement_descriptor_kanji: null;
}

export interface MerchantAccountDataAccountMerchantAccountDataAccountSettingsPayouts {
	schedule: MerchantAccountDataAccountMerchantAccountDataAccountSettingsPayoutsSchedule;
	statement_descriptor: null;
	debit_negative_balances: boolean;
}

export interface MerchantAccountDataAccountMerchantAccountDataAccountSettingsPayoutsSchedule {
	interval: string;
	delay_days: number;
}

export interface MerchantAccountDataAccountAccountTosAcceptance {
	ip: null;
	date: null;
	user_agent: null;
}

export interface MerchantProfileResponse {
	status: string;
	message: string;
	data: MerchantProfileData;
}

export interface MerchantProfileData {
	profile_id: string;
	business_id: string;
	customer_id: string;
	platform_id: number;
	created_at: Date;
	updated_at: Date;
	profile: MerchantProfileDataProfile;
	accounts: MerchantProfileDataAccountElement[];
}

export interface MerchantProfileDataAccountElement {
	account_id: string;
	processor_account_id: string;
	status: number;
	account: MerchantProfileDataAccountElementAccountAccount;
	/** Derived processor status from backend - used for display */
	processor_status: WorthProcessorStatus | WorthPreProcessorStatus;
}

export interface MerchantProfileDataAccountElementAccountAccount {
	id: string;
	type: string;
	email: null;
	object: string;
	company: MerchantProfileDataAccountElementAccountAccountCompany;
	country: string;
	created: number;
	metadata: Metadata;
	settings: MerchantProfileDataAccountElementAccountAccountSettings;
	controller: MerchantProfileDataAccountElementAccountAccountController;
	capabilities: MerchantProfileDataAccountElementAccountAccountAccountCapabilities;
	requirements: MerchantProfileDataAccountElementAccountAccountAccountFutureRequirements;
	business_type: string;
	tos_acceptance: MerchantProfileDataAccountElementAccountAccountAccountTosAcceptance;
	charges_enabled: boolean;
	payouts_enabled: boolean;
	business_profile: MerchantProfileDataAccountElementAccountAccountBusinessProfile;
	default_currency: string;
	details_submitted: boolean;
	external_accounts: MerchantProfileDataAccountElementAccountAccountExternalAccounts;
	future_requirements: MerchantProfileDataAccountElementAccountAccountAccountFutureRequirements;
}

export interface MerchantProfileDataAccountElementAccountAccountBusinessProfile {
	mcc: string;
	url: null;
	name: string;
	support_url: null;
	support_email: null;
	support_phone: string;
	annual_revenue: null;
	support_address: null;
	product_description: null;
	estimated_worker_count: null;
	minority_owned_business_designation: null;
}

export interface MerchantProfileDataAccountElementAccountAccountAccountCapabilities {
	transfers: string;
	card_payments: string;
	us_bank_account_ach_payments: string;
}

export interface MerchantProfileDataAccountElementAccountAccountCompany {
	name: string;
	address: MerchantProfileDataAccountElementAccountAccountCompanyAddress;
	verification: MerchantProfileDataAccountElementAccountAccountCompanyVerification;
	owners_provided: boolean;
	tax_id_provided: boolean;
	directors_provided: boolean;
	executives_provided: boolean;
}

export interface MerchantProfileDataAccountElementAccountAccountCompanyAddress {
	city: string;
	line1: string;
	line2: null;
	state: string;
	country: string;
	postal_code: string;
}

export interface MerchantProfileDataAccountElementAccountAccountCompanyVerification {
	document: Document;
}

export interface MerchantProfileDataAccountElementAccountAccountCompanyVerificationDocument {
	back: null;
	front: null;
	details: null;
	details_code: null;
}

export interface MerchantProfileDataAccountElementAccountAccountController {
	fees: {
		payer: string;
	};
	type: string;
	losses: {
		payments: string;
	};
	is_controller: boolean;
	stripe_dashboard: {
		type: string;
	};
	requirement_collection: string;
}

export interface MerchantProfileDataAccountElementAccountAccountExternalAccounts {
	url: string;
	data: MerchantProfileDataAccountElementAccountAccountExternalAccountsDatum[];
	object: string;
	has_more: boolean;
	total_count: number;
}

export interface MerchantProfileDataAccountElementAccountAccountExternalAccountsDatum {
	id: string;
	last4: string;
	object: string;
	status: string;
	account: string;
	country: string;
	currency: string;
	metadata: Metadata;
	bank_name: string;
	fingerprint: string;
	account_type: null;
	requirements: MerchantProfileDataAccountElementAccountAccountExternalAccountsDatumDatumFutureRequirements;
	routing_number: string;
	account_holder_name: null;
	account_holder_type: null;
	future_requirements: MerchantProfileDataAccountElementAccountAccountExternalAccountsDatumDatumFutureRequirements;
	default_for_currency: boolean;
	available_payout_methods: string[];
}

export interface MerchantProfileDataAccountElementAccountAccountExternalAccountsDatumDatumFutureRequirements {
	errors: any[];
	past_due: any[];
	currently_due: any[];
	pending_verification: any[];
}

export interface MerchantProfileDataAccountElementAccountAccountAccountFutureRequirements {
	errors: any[];
	past_due: string[];
	alternatives: Array<{
		original_fields_due: string[];
		alternative_fields_due: string[];
	}>;
	currently_due: string[];
	eventually_due: string[];
	disabled_reason: null | string;
	current_deadline: null;
	pending_verification: any[];
}

export interface MerchantProfileDataAccountElementAccountAccountSettings {
	payouts: Payouts;
	branding: Branding;
	invoices: Invoices;
	payments: Payments;
	dashboard: Dashboard;
	card_issuing: CardIssuing;
	card_payments: SettingsCardPayments;
	bacs_debit_payments: BacsDebitPayments;
	sepa_debit_payments: Metadata;
}

export interface BacsDebitPayments {
	display_name: null;
	service_user_number: null;
}

export interface Branding {
	icon: null;
	logo: null;
	primary_color: null;
	secondary_color: null;
}

export interface CardIssuing {
	tos_acceptance: CardIssuingTosAcceptance;
}

export interface CardIssuingTosAcceptance {
	ip: null;
	date: null;
}

export interface SettingsCardPayments {
	decline_on: DeclineOn;
	statement_descriptor_prefix: string;
	statement_descriptor_prefix_kana: null;
	statement_descriptor_prefix_kanji: null;
}

export interface DeclineOn {
	avs_failure: boolean;
	cvc_failure: boolean;
}

export interface Dashboard {
	timezone: string;
	display_name: string;
}

export interface Invoices {
	default_account_tax_ids: null;
	hosted_payment_method_save: string;
}

export interface Payments {
	statement_descriptor: string;
	statement_descriptor_kana: null;
	statement_descriptor_kanji: null;
}

export interface Payouts {
	schedule: Schedule;
	statement_descriptor: null;
	debit_negative_balances: boolean;
}

export interface Schedule {
	interval: string;
	delay_days: number;
}

export interface MerchantProfileDataAccountElementAccountAccountAccountTosAcceptance {
	ip: null;
	date: null;
	user_agent: null;
}

export interface MerchantProfileDataProfile {
	tin: string;
	people: {
		owners: any[];
	};
	stripe: {
		capabilities: {
			transfers: {
				requested: boolean;
			};
			card_payments: {
				requested: boolean;
			};
			us_bank_account_ach_payments: {
				requested: boolean;
			};
		};
	};
	country: string;
	mcc_code: string;
	address_city: string;
	banking_info: null;
	address_state: string;
	business_name: string;
	address_line_1: string;
	address_line_2: null;
	business_phone: string;
	business_website: null;
	address_postal_code: string;
}

/**
 * Pre-processor statuses for accounts that haven't been submitted to Stripe yet
 */
export enum WorthPreProcessorStatus {
	/** Merchant profile exists but no Stripe account has been created */
	NOT_SUBMITTED = "NOT_SUBMITTED",
}

/**
 * Processor account status - matches backend PaymentProcessorAccountStatus
 * These statuses are returned directly from the API via the processor_status field
 */
export enum WorthProcessorStatus {
	/** Initial/undetermined state */
	UNKNOWN = "UNKNOWN",
	/** Account is fully operational - charges and payouts enabled, all capabilities active */
	ACTIVE = "ACTIVE",
	/** Stripe is verifying submitted information */
	PENDING = "PENDING",
	/** Account has restrictions - charges or payouts disabled, or capabilities inactive */
	RESTRICTED = "RESTRICTED",
	/** Additional information is required from the user */
	INFO_REQUIRED = "INFO_REQUIRED",
	/** Account has been rejected by Stripe */
	REJECTED = "REJECTED",
}

export interface MerchantAccountTableFormat {
	processorId: number;
	status: number;
	profileId: string;
	createdAt: Date | string;
	updatedAt: Date | string;
	/** Human-readable processor status from API - use this for display */
	processorStatus: WorthProcessorStatus | WorthPreProcessorStatus;
}

export interface onboardPaymentProcessorAccountsPayload {
	customerId: string;
	businessIds: string[];
	platformId: number;
	processorId: string;
}

export interface OnboardPaymentProcessorAccountsResponse {
	data: any;
	message: string;
	status: string;
}

export interface RerunIntegrationsRequestBody {
	fact_names?: string[];
	task_codes?: string[];
	platform_codes?: string[];
	platform_categories?: string[];
}

/**
 * KYC Facts API Types
 */
export interface FactsKycOwnerData {
	id: string;
	first_name: string | null;
	last_name: string | null;
	date_of_birth: string | null;
	ssn: string | null;
	email: string | null;
	mobile: string | null;
	title?: { id: number; title: string } | number | null;
	address_line_1: string | null;
	address_line_2: string | null;
	address_apartment: string | null;
	address_city: string | null;
	address_state: string | null;
	address_postal_code: string | null;
	address_country: string | null;
	ownership_percentage?: number | null;
	owner_type?: "CONTROL" | "BENEFICIARY" | null;
	created_at: string | null;
	updated_at: string | null;
	created_by?: string;
	updated_by?: string;
}

export interface FactsKycEmailReport {
	name: string | null;
	email: string | null;
	is_deliverable: string | null;
	breach_count: number | null;
	first_breached_at: string | null;
	last_breached_at: string | null;
	domain_registered_at: string | null;
	domain_is_free_provider: string | null;
	domain_is_disposable: string | null;
	top_level_domain_is_suspicious: string | null;
	ip_spam_list_count: number | null;
}

export interface FactsKycFraudReport {
	name: string | null;
	user_interactions: string | null;
	fraud_ring_detected: string | null;
	bot_detected: string | null;
	synthetic_identity_risk_score: number | null;
	stolen_identity_risk_score: number | null;
}

export interface FactsKycOwnerVerification {
	email_report: FactsKycEmailReport | null;
	fraud_report: FactsKycFraudReport | null;
}

export interface FactsKycOverride {
	value: FactsKycOwnerData[];
	source: string;
	userID: string;
	comment: string;
	timestamp: string;
}

export interface FactsKycResponse {
	status: string;
	message: string;
	data: {
		owners_submitted: {
			name: string;
			value: FactsKycOwnerData[];
			schema: unknown;
			source: {
				confidence: number | null;
				platformId: number;
				updatedAt?: string;
				name?: string;
			} | null;
			override: FactsKycOverride | null;
			alternatives: Array<{
				value: FactsKycOwnerData[];
				source: number;
				confidence: number;
				updatedAt: string;
			}>;
		};
		owner_verification: {
			name: string;
			value: Record<string, FactsKycOwnerVerification> | null;
			schema: unknown;
			source: {
				confidence: number | null;
				platformId: number;
				name?: string;
			} | null;
			override: unknown | null;
			alternatives: unknown[];
		};
		guest_owner_edits?: string[];
	};
}

export interface RunMatchProParams {
	customerId: string;
	businessId: string;
	icas?: string[];
}
/** Case tab values endpoint: GET /business/:businessId/case/:caseId/values */
export interface CaseTabValuesItem {
	value: string | number | boolean | null;
	description?: string | null;
}

export interface CaseTabValuesData {
	values: Record<string, CaseTabValuesItem>;
	/** When results baseline was set (e.g. case_results_executions.created_at). ISO8601 or null. */
	created_at?: string | null;
	/** When case_results_executions row was last updated (e.g. after re-run). ISO8601 or null. Used for "Regenerated on" UI. */
	updated_at?: string | null;
	/** True if any source (fact override, public records, IDV) changed after baseline (updated_at). */
	has_updates_since_generated?: boolean;
	/** Number of source areas with newer timestamp (for "x update(s) made"). */
	updates_count?: number;
}

export type GetCaseTabValuesResponse = ApiResponse<CaseTabValuesData>;
