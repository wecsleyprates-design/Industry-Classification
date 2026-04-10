import { type IPayload } from "./common";

import { type CASE_STATUS_ENUM } from "@/constants/case-status";

export interface ICaseForm {
	firstName: string;
	lastName: string;
	email: string;
	mobile?: string | null;
	companyName: string;
	companyMobile?: string | null;
}

export interface ICaseFormBoolean {
	firstName?: boolean;
	lastName?: boolean;
	email?: boolean;
	mobile?: boolean;
	companyName?: boolean;
	companyMobile?: boolean;
}

export interface CreateBusinessRequest {
	body: CaseRequestBody & { customer_id: string };
}

interface CaseRequestBody {
	first_name?: string;
	last_name?: string;
	email?: string;
	status?: string;
	mobile?: string;
	business_name?: string;
	business_mobile?: string;
}

export interface ICaseApiResponse {
	status: string;
	message: string;
	data: any;
}
export interface GetCasesRequest {
	customerId: string;
	params: IPayload;
}

export interface ICase {
	id: string;
	applicant_id: string;
	created_at: string;
	case_type: number;
	business_id: string;
	business_name: string;
	status_label: string;
	assignee: Record<string, unknown>;
	naics_code: string | null;
	naics_title: string | null;
	mcc_code: string | null;
	mcc_title: string | null;
	applicant: {
		first_name: string;
		last_name: string;
	};
	status: {
		id: number;
		code: keyof typeof CASE_STATUS_ENUM;
		label: string;
	};
	report_status:
		| "REQUESTED"
		| "IN_PROGRESS"
		| "COMPLETED"
		| "FAILED"
		| "FAILED_SECOND_TIME"
		| "DOWNLOAD_REPORT_AVAILABLE"
		| "DOWNLOAD_REPORT_UNAVAILABLE";
	report_id: string | null;
	report_created_at: string | null;
	metadata: {
		formation_date: string;
		age: number;
		revenue: number;
		naics_code: string | null;
		naics_title: string | null;
		mcc_code: string | null;
		mcc_title: string | null;
	};
}

export interface GetCasesResponse {
	status: string;
	message: string;
	data: {
		records: ICase[];
		total_pages: number;
		total_items: string;
	};
}

export interface GetCaseRequest {
	customerId: string;
	caseId: string;
	params?: IPayload;
}
export interface UpdateCaseByCaseId extends GetCaseRequest {
	body: {
		status?: string;
		assignee?: string;
	};
	caseID: string;
	customerID: string;
}

interface CaseRequestBody {
	first_name?: string;
	last_name?: string;
	email?: string;
	mobile?: string;
}

interface Industry {
	id: number;
	name: string;
	code: string;
	sector_code: string;
	created_at: string;
	updated_at: string;
}

interface Business {
	id: string;
	name: string;
	tin: string;
	address_line_1: string;
	address_line_2: string | null;
	address_city: string;
	address_state: string;
	address_postal_code: string;
	address_country: string;
	created_at: string;
	created_by: string;
	updated_at: string;
	updated_by: string;
	mobile: string | null;
	official_website: string | null;
	public_website: string | null;
	social_account: string | null;
	status: string;
	industry: Industry;
	mcc_id: number;
	naics_id: number;
	naics_code: number;
	naics_title: string;
	mcc_code: number;
	mcc_title: string;
}

interface OwnerTitle {
	id: number;
	title: string;
}

interface Owner {
	id: string;
	title: OwnerTitle;
	first_name: string;
	last_name: string;
	ssn: string;
	email: string;
	mobile: string;
	date_of_birth: string;
	address_apartment: string | null;
	address_line_1: string;
	address_line_2: string | null;
	address_city: string;
	address_state: string;
	address_postal_code: string;
	address_country: string;
	created_at: string;
	created_by: string;
	updated_at: string;
	updated_by: string;
	ownership_percentage: number;
	owner_type: "CONTROL" | "BENEFICIAL";
}

interface StatusHistoryEntry {
	id: number;
	status: string;
	created_at: string;
	created_by: string;
}

interface CaseApplicant {
	first_name: string;
	last_name: string;
	created_at: string;
}

interface CaseStatus {
	id: string;
	code: number;
	label: string;
}

export interface Condition {
	fields: string[];
	dependency: string;
	visibility: string;
}

export interface Rule {
	rule: string;
	condition: Condition;
}

export interface CustomField {
	id: string;
	label: string;
	is_sensitive?: boolean;
	internalName?: string;
	property: string;
	step_name: string;
	sequence_number: number;
	rules?: Rule[];
	value: any;
	type?: string;
	fileName?: string[];
}

export interface GetCaseseByIdResponseBody {
	status: string;
	message: string;
	data: {
		id: string;
		applicant_id: string;
		customer_id: string;
		status: CaseStatus;
		created_at: string;
		created_by: string;
		updated_at: string;
		updated_by: string;
		business_id: string;
		case_type: number;
		assignee: Record<string, unknown>;
		assigner: string | null;
		business: Business;
		applicant: CaseApplicant;
		owners: Owner[];
		status_history: StatusHistoryEntry[];
		business_names: string[];
		business_addresses: string[];
		custom_fields: CustomField[];
	};
}

interface ScoreFactor {
	id: number;
	code: string;
	label: string;
	category_id: number;
	is_deleted: boolean;
	parent_factor_id: null;
	weightage: number;
	factor_id: number;
	value: number;
	score_100: number;
	weighted_score_100: number;
	score_850: number;
	weighted_score_850: number;
	status: string;
	log: string;
}

interface ScoreDistributionCategory {
	id: number;
	code: string;
	label: string;
	is_deleted: boolean;
	total_weightage: number;
	factors: ScoreFactor[];
	score: string;
	score_100: string;
	score_850: string;
}

export interface GetWorthScoreByCaseIdResponse {
	status: string;
	message: string;
	data: {
		id: string;
		created_at: string;
		case_id: string;
		status: string;
		weighted_score_100: string;
		weighted_score_850: string;
		risk_level: string;
		score_decision: string;
		version: string;
		base_score: string;
		score_distribution: ScoreDistributionCategory[];
		is_score_calculated: boolean;
	};
}

export interface SendInvitationPayload {
	customerId: string;
	payload: PostSendInvitationBody;
}

export interface PostSendInvitationBody {
	existing_business?: {
		business_id?: string;
		name?: string;
	};
	new_business?: {
		name?: string;
		mobile?: string;
	};
	existing_applicant_ids?: string[];
	new_applicants: [
		{
			first_name: string;
			last_name: string;
			email: string;
			mobile?: string;
		},
	];
	is_no_login?: boolean;
}

export interface IStatusUpdateForm {
	status: keyof typeof CASE_STATUS_ENUM;
	assignee?: string;
	comment?: string;
}

export interface UpdateCase {
	newStatus: keyof typeof CASE_STATUS_ENUM;
	userId: string;
	caseId: string;
}

export interface ArchiveCaseBody {
	caseId: string;
	customerId: string;
	body: {
		status: keyof typeof CASE_STATUS_ENUM;
	};
}

export interface AddCaseAuditTrailCommentPayload {
	caseId: string;
	businessId: string;
	comment: string;
	file?: File;
}

export interface UpdateCaseAuditTrailCommentPayload {
	caseId: string;
	commentId: string;
	body: { comment: string };
}

export interface RefreshScorePayload {
	customerId: string;
	businessId: string;
}

export interface RefreshProcessingTime {
	status: string;
	message: string;
	data: Data;
}

export interface Data {
	processing_time: string;
	waiting_time: string;
	is_refresh_score_enable: boolean;
	processing_time_unit: string;
}

export interface GetOnboardingSetupResponse {
	status: string;
	message: string;
	data: GetOnboardingSetupResponseData[];
}

export interface GetOnboardingSetupResponseData {
	setup_id: number;
	is_enabled: boolean;
	code:
		| "lightning_verification_setup"
		| "modify_pages_fields_setup"
		| "white_label_setup"
		| "onboarding_setup"
		| "equifax_credit_score_setup";
	label: string;
}

export interface CaseStatusResponse {
	status: string;
	message: string;
	data: Array<{
		id: number;
		code: keyof typeof CASE_STATUS_ENUM;
		label: string;
	}>;
}

export interface CaseType {
	id: number;
	code: "onboarding" | "risk" | "application_edit";
	label: string;
}

export interface GetCaseTypesResponse {
	status: string;
	message: string;
	data: {
		records: CaseType[];
		total_pages: number;
		total_items: number;
	};
}

export type CaseStatusVariant =
	| "manually-rejected"
	| "auto-rejected"
	| "auto-approved"
	| "manually-approved"
	| "under-manual-review"
	| "info-requested"
	| "pending-decision"
	| "submitted"
	| "score-generated"
	| "created"
	| "archived"
	| "information-updated"
	| "onboarding"
	| "risk-alert"
	| "investigating"
	| "escalated"
	| "paused"
	| "dismissed"
	| "needs-review";

export type ReportStatus =
	| "COMPLETED"
	| "REQUESTED"
	| "IN_PROGRESS"
	| "FAILED"
	| "DOWNLOAD_REPORT_AVAILABLE"
	| "DOWNLOAD_REPORT_UNAVAILABLE"
	| "FAILED_SECOND_TIME";
export interface ReportStatusType {
	status: string;
	message: string;
	data: {
		status: ReportStatus;
		report_details?: StatusData;
	};
}

export interface StatusData {
	id: string;
	report_type_id: number;
	status: ReportStatus;
	log: null;
	created_at: Date;
	created_by: string;
	updated_at: Date;
	triggered_by: string;
	triggered_id: string;
	report_type: ReportType;
}

export interface ReportType {
	core_report_types: CoreReportTypes;
}

export interface CoreReportTypes {
	id: number;
	code: string;
	label: string;
}

export interface DownloadReportType {
	status: string;
	message: string;
	data: DownloadReportData;
}

export interface DownloadReportData {
	id: string;
	report_type_id: number;
	status: string;
	log: null;
	created_at: Date;
	created_by: string;
	updated_at: Date;
	triggered_by: string;
	triggered_id: string;
	report_type: ReportType;
	pdf_url: string;
}
