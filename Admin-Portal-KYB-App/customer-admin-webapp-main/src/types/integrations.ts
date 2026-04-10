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

export interface BusinessNpiResponse {
	status: string;
	message: string;
	data: BusinessNpiData;
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
	metadata?: NpiMetadada;
	guest_owner_edits?: string[];
	is_matched: boolean;
}

export interface NpiMetadada {
	["provider license number state code_1"]?: string;
	["provider license number_1"]?: string;
	["healthcare provider taxonomy code_1"]?: string;
	["provider name prefix text"]?: string;
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

export interface IncomeStatementUpdatedResponse {
	status: string;
	message: string;
	data: Array<{
		year: number;
		start_date: string;
		end_date: string;
		income_statement: IncomeStatement;
	}>;
}

export interface IncomeStatement {
	revenue: Record<string, number>;
	cost_of_goods_sold: Record<string, number>;
	expenses: Record<string, number>;
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

export interface eqifaxCreditReportDataResponse {
	status: string;
	message: string;
	data: eqifaxCreditReportDataResponseData;
}

export type eqifaxCreditReportDataResponseData = Record<
	string,
	eqifaxCreditReportDataResponseObject
>;

export interface eqifaxCreditReportDataResponseObject {
	fileName: string;
	signedRequest: string;
	url: string;
}

export interface GetProcessingStatementsResponse {
	status: string;
	message: string;
	data: Array<{
		id: string;
		case_id: string;
		ocr_document_id: string | null;
		american_express_data: SectionData;
		card_data: SectionData;
		point_of_sale_data: PointOfSaleData;
		general_data: GeneralSectionData;
		seasonal_data: SeasonalSectionData;
		created_at: Date;
		created_by: string;
		updated_at: Date;
		updated_by: string;
		file_name: string;
		file_path: string;
		guest_owner_edits: string[];
	}>;
}
export interface SectionData {
	desired_limit: number;
	monthly_volume: number;
	annual_volume: number;
	high_ticket_size: number;
	average_ticket_size: number;
	guest_owner_edits?: string[];
}

export interface GeneralSectionData {
	desired_limit: number;
	monthly_volume: number;
	annual_volume: number;
	high_ticket_size: number;
	average_ticket_size: number;
	monthly_occurrence_of_high_ticket: string;
	explanation_of_high_ticket: string | null;
	guest_owner_edits?: string[];
}

export interface SeasonalSectionData {
	is_seasonal_business: boolean;
	high_volume_months: string[] | null;
	explanation_of_high_volume_months: string | null;
	guest_owner_edits?: string[];
}

export interface PointOfSaleData {
	e_commerce: number;
	typed_cards: number;
	swiped_cards: number;
	mail_telephone: number;
	guest_owner_edits?: string[];
}

export interface APIResponseType<T = any> {
	status: string;
	message: string;
	data: T;
}

export interface FactBusinessDetailsResponseType {
	business_name: FactResponse<string>;
	business_phone: FactResponse<string>;
	dba: FactResponse<string[] | string>;
	industry: FactResponse<{ id: number; name: string; sector_code: string }>;
	mailing_address: FactResponse<PrimaryAddressValue[]>;
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
	guest_owner_edits: string[];
}
export interface KybUpdatedResponseTypeData {
	address_match: FactResponse<string>;
	address_match_boolean: FactResponse<boolean>;
	address_registered_agent: FactResponse<MatchValue>;
	address_verification: FactResponse<AddressesValue>;
	address_verification_boolean: FactResponse<boolean>;
	addresses: FactResponse<string[]>;
	addresses_deliverable: FactResponse<string[]>;
	corporation: FactResponse<string>;
	formation_date: FactResponse<string | Date>;
	formation_state: FactResponse<string>;
	kyb_submitted: FactResponse<boolean>;
	legal_name: FactResponse<string>;
	minority_owned: FactResponse<boolean>;
	name_match: FactResponse<MatchValue>;
	name_match_boolean: FactResponse<boolean>;
	names_submitted: FactResponse<NamesSubmittedValue[]>;
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

export interface FactResponse<T = any> {
	name: string;
	value: T | undefined;
	dependencies?: string[];
	"source.confidence"?: number;
	"source.platformId": number;
	"source.name"?: string;
	alternatives: Array<{ value: T; confidence: number; platform?: number }>;
}

export interface AddressesValue {
	addresses: string[];
	sublabel: string;
	message: string;
}
export interface PeopleObjectValue {
	name: string;
	titles: string[];
	submitted?: boolean;
	source?: string[];
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

export interface PrimaryAddressValue {
	line_1: string;
	apartment: null;
	city: string;
	state: string;
	country?: string;
	postal_code: string;
	mobile?: null;
	is_primary: boolean;
}

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

export interface Metadatum {
	id: string;
	type: string;
	metadata: Metadata;
}

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
}
