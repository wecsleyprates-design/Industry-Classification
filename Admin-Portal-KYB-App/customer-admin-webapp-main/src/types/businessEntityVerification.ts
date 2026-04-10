export interface MetadataItem {
	id: string;
	type: string;
	metadata: Record<string, any>;
}

export interface BaseReviewTask {
	id: string;
	business_entity_verification_id: string;
	created_at: string;
	updated_at: string | null;
	category: string;
	key: string;
	status: string;
	message: string;
	label: string;
	sublabel: string;
	metadata: MetadataItem[];
}

export interface BusinessNameDetails {
	name: string;
	submitted: boolean;
}

export interface BusinessNameReviewTaskMetadata {
	id: string;
	type: string;
	metadata: {
		name: string;
		submitted: boolean;
	};
}
export interface BusinessNameReviewTask extends Omit<
	BaseReviewTask,
	"metadata"
> {
	key: "name";
	metadata: BusinessNameReviewTaskMetadata[];
}

export interface WatchlistHitDetails {
	abbr: string;
	title: string;
	agency: string;
	agency_abbr: string;
	entity_name: string;
}
export interface WatchlistReviewTaskMetadata {
	id: string;
	type: string;
	metadata: WatchlistHitDetails;
	url: string;
	list_country: string;
}

export interface WatchlistPersonResponse {
	status: string;
	message: string;
	data: {
		records: WatchlistPerson[];
	};
}

export interface WatchlistPerson {
	id: string;
	name: string;
	titles: string[];
	watchlist_results: Array<{
		id: string;
		type: string;
		url: string;
		list_country: string;
		metadata: WatchListPersonMeta;
	}>;
}

export interface WatchListPersonMeta {
	abbr: string;
	title: string;
	agency: string;
	agency_abbr: string;
	entity_name: string;
}

export interface WatchlistReviewTask extends Omit<BaseReviewTask, "metadata"> {
	key: "watchlist";
	metadata: WatchlistReviewTaskMetadata[];
}

export interface AddressVerificationDetails {
	city: string;
	state: string;
	submitted: boolean;
	postal_code: string;
	full_address: string;
	address_line1: string;
	address_line2: string | null;
}
export interface AddressVerificationReviewTaskMetadata {
	id: string;
	type: string;
	metadata: AddressVerificationDetails;
}

export interface AddressVerificationReviewTask extends Omit<
	BaseReviewTask,
	"metadata"
> {
	key: "address_verification";
	metadata: AddressVerificationReviewTaskMetadata[];
}

export interface Registration {
	id: string;
	business_entity_verification_id: string;
	created_at: string;
	updated_at: string | null;
	external_id: string;
	name: string;
	status: string;
	sub_status: string | null;
	status_details: string | null;
	jurisdiction: string;
	entity_type: string;
	file_number: string;
	full_addresses: string[];
	registration_date: string;
	registration_state: string;
	source: string;
}

export interface AddressSource {
	id: string;
	business_entity_verification_id: string;
	created_at: string;
	updated_at: string | null;
	external_id: string;
	external_registration_id: string;
	full_address: string;
	address_line_1: string;
	address_line_2: string | null;
	city: string;
	state: string;
	postal_code: string;
	lat: number | null;
	long: number | null;
	submitted: boolean;
	deliverable: boolean;
	cmra: boolean;
	address_property_type: string | null;
}

interface AddressDetails {
	address_line1: string;
	address_line2?: string; // Optional
	city: string;
	state: string;
	postal_code: string;
}

export interface UpdateBusinessEntityRequest {
	tin: {
		tin: string;
	};
	name: string;
	addresses: AddressDetails[];
}

export interface BusinessVerificationEntityRecord {
	id: string;
	created_at: string;
	updated_at: string | null;
	business_integration_task_id: string;
	external_id: string;
	business_id: string;
	name: string;
	status: string;
	tin: string;
	formation_date?: string;
	formation_state: string;
	number_of_employees: string;
	year: string;
}

export interface BusinessEntityVerificationResponse {
	status: string;
	message: string;
	data: {
		businessEntityVerification: BusinessVerificationEntityRecord;
		people?: Person[] | [];
		names?: Name[] | [];
		reviewTasks: BaseReviewTask[];
		registrations: Registration[];
		addressSources: AddressSource[];
	};
}

export interface BusinessApplicantVerificationResponse {
	status: string;
	message: string;
	data: {
		applicant: {
			id: string;
			status?: string;
			updated_at?: Date;
			risk_check_result?: {
				name: string;
				address: string;
				dob: string;
				documents_verification: string;
				phone: string;
				email: string;
				user_interactions: string;
				synthetic_identity_risk_score: number;
				stolen_identity_risk_score: number;
			};
		};
		identity_verification_attempted?: boolean;
	};
}

export interface Person {
	id: string;
	business_entity_verification_id: string;
	created_at: Date;
	updated_at: Date;
	name: string;
	titles: string[];
	submitted: boolean;
	source: Source[];
	metadata: null;
}

export interface Name {
	id: string;
	business_entity_verification_id: string;
	created_at: Date;
	updated_at: Date;
	name: string;
	type: string;
	submitted: boolean;
	source: Source[];
	metadata: null;
}

export interface Source {
	id: string;
	type: string;
	metadata: Metadata;
}

export interface Metadata {
	state: string;
	status: string;
	file_number: string;
	jurisdiction: string;
}

export interface GetBusinessTradeLinesResponse {
	status: string;
	message: string;
	data: GetBusinessTradeLinesData;
}

export interface ExtractedDetails {
	taxID?: string;
	legalName?: string;
	addressZip?: string;
	ownerNames?: string[];
	addressCity?: string;
	addressState?: string;
	businessType?: string;
	addressStreet?: string;
	incorporationDate?: string;
	registrationState?: string;
	addressStreetLineTwo?: string;
}

export interface ExtractedVerificationData {
	documentType: string;
	extractedDetails: ExtractedDetails;
	summaryOfExtractedDetails: string;
}

export interface VerificationUploadsData {
	id: string;
	business_id: string;
	file_name: string;
	file_path: string;
	extracted_data: ExtractedVerificationData;
}

export interface ExtractedVerificationUploadsResponse {
	status: string;
	message: string;
	data: VerificationUploadsData[];
}

export interface GetBusinessTradeLinesData {
	trade_lines: TradeLines;
}

export interface TradeLines {
	non_financial_acc_reported_24_months_count: number;
	max_non_financial_balance_24_months: number;
	og_credit_limit_non_financial_acc_reported_24_months: string;
	max_acc_limit_non_financial_acc_reported_24_months: number;
	non_financial_acc_cycles_due_or_charge_off_24_months_count: number;
	new_non_financial_acc_opened_3_months: number;
	total_non_financial_charge_off_amount_24_monts: string;
	satisfactory_non_financial_acc_percentage_24_months: number;
	worst_non_financial_payment_status_24_months: number;
}
