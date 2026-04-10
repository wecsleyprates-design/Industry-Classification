import { type ApiResponse } from "@/types/api";
import { type IPayload } from "@/types/common";
import { type ReportStatus } from "@/types/report";

import { type CASE_STATUS_ENUM } from "@/constants/case-status";
import { type WORKFLOW_DECISION_ENUM } from "@/constants/Workflows";

export type FieldValue = string | number | boolean;

export interface CaseForm {
	firstName: string;
	lastName: string;
	email: string;
	mobile?: string | null;
	companyName: string;
	companyMobile?: string | null;
}

export interface CaseFormBoolean {
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

export type AdverseMediaResponse = ApiResponse<AdverseMediaResponseData>;

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
	score?: number;
	generated_at?: string;
	model_version?: string;
	articles: AdverseMediaResponseDataArticle[];
}

export interface AdverseMediaResponseDataArticle {
	id: string;
	adverse_media_id: string;
	business_id: string;
	title: string;
	link: string;
	date: string;
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

export interface AdverseMediaItem {
	title: string;
	date: string;
	risk_description: string;
	entity_focus_score: number;
	risk_level: string;
	link: string;
	media_type?: string;
	source?: string;
}

export type RiskLevel = "low" | "moderate" | "high";

export interface MediaEntry {
	title: string;
	publishedDate: string;
	summary: string;
	confidenceScore: number;
	risk: RiskLevel;
	sourceUrl?: string;
	mediaType?: "business" | string; // "business" or individual name (any string since we don't know specific names)
	source?: string;
}

export interface MediaTypeGroup {
	articles: MediaEntry[];
	allArticles: MediaEntry[];
	riskLevel: RiskLevel;
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

export interface CaseApiResponse {
	status: string;
	message: string;
	data: any;
}
export interface GetCasesRequest {
	customerId: string;
	params: IPayload;
}

export interface Case {
	id: string;
	applicant_id: string;
	created_at: string;
	case_type: number;
	business_id: string;
	business_name: string;
	dba_name?: string;
	aging_threshold: string;
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
	report_status: ReportStatus;
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
	is_integration_complete: boolean | null;
}

export interface GetCasesResponse {
	status: string;
	message: string;
	data: {
		records: Case[];
		total_pages: number;
		total_items: number;
	};
}

export interface GetCaseRequest {
	customerId: string;
	caseId: string;
	params?: IPayload;
	businessId: string | null;
	moduleType: "customer_case" | "business_case" | "standalone_case";
	platformType?: "admin" | "customer";
}
export interface UpdateCaseByCaseIdRequestPayload {
	body: {
		status?: string;
		assignee?: string;
	};
	caseId: string;
	customerId: string;
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

export interface OwnerTitle {
	id: number;
	title: string;
}

export interface Owner {
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
	owner_type: "CONTROL" | "BENEFICIARY";
	guest_owner_edits?: string[];
	is_ssn_decryptable?: boolean;
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

interface GetCaseByIdCaseStatus {
	id: CASE_STATUS_ENUM;
	code: number;
	label: string;
}

export interface CaseStatus {
	id: number;
	code: keyof typeof CASE_STATUS_ENUM;
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

/** Option for dropdown/checkbox custom fields */
export interface CustomFieldOption {
	label: string;
	value: string;
	/** Display label for checkbox options (e.g. " Yes", " Legal Name"). Set by the template builder. */
	checkbox_type?: string;
	input_type?: string;
	icon?: string;
	icon_position?: string;
}

export interface CustomField {
	id: string;
	label: string;
	is_sensitive: boolean;
	internalName: string;
	property:
		| "alphanumeric"
		| "integer"
		| "dropdown"
		| "decimal"
		| "text"
		| "boolean"
		| "full_text"
		| "checkbox"
		| "upload"
		| "phone_number"
		| "email"
		| "date";
	step_name: string;
	sequence_number: number;
	rules?: Rule[];
	value:
		| string
		| null
		| string[]
		| Array<{
				label: string;
				value: string;
				checkbox_type?: string;
				checked?: boolean;
		  }>;
	type?: string;
	fileName?: string[];
	/** Options for dropdown/checkbox fields */
	field_options?: CustomFieldOption[] | null;
	user?: {
		email?: string;
		first_name?: string;
		id?: string;
		last_name?: string;
		role?: "admin" | "customer" | "applicant";
	};
}

export type GetCaseByIdResponse = ApiResponse<CaseData>;

export interface CaseData {
	id: string;
	applicant_id: string;
	customer_id: string;
	status: GetCaseByIdCaseStatus;
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
	business_names: Array<{
		name: string;
		is_primary: boolean;
	}>;
	business_addresses: string[];
	custom_fields: CustomField[];
	risk_alerts: RiskAlert[];
	guest_owner_edits?: string[];
	application_progress?: {
		percent_complete: number;
		is_submitted: boolean;
	};
	aging: Aging;
	is_integration_complete: boolean | null;
}

export interface Aging {
	urgency: string;
	days_since_invited: number;
	urgency_threshold_days: number;
	custom_message: string;
	due_date: Date;
	config_source: "business" | "customer";
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
		risk_level: "HIGH" | "MODERATE" | "LOW";
		score_decision: string;
		version: string;
		base_score: string;
		score_distribution: ScoreDistributionCategory[];
		is_score_calculated: boolean;
		/** When user last acknowledged case results (Re-verify). Same store as score date. */
		values_generated_at?: string | null;
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

export interface ArchiveCaseBody {
	caseId: string;
	customerId: string;
	body: {
		status: keyof typeof CASE_STATUS_ENUM;
	};
}

export interface CreateCaseAuditTrailCommentPayload {
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
		| "equifax_credit_score_setup"
		| "post_submission_editing_setup";
	label: string;
}

export type GetCaseStatusesResponse = ApiResponse<CaseStatus[]>;

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

export type GetOwnerTitlesResponse = ApiResponse<OwnerTitle[]>;

export type CaseStatusVariant =
	| "manually-rejected"
	| "auto-rejected"
	| "auto-approved"
	| "manually-approved"
	| "under-manual-review"
	| "information-requested"
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
	| "invited";

export interface CustomerOnboardingInvitePayload {
	customerId: string;
	caseId: string;
}

export type CustomerOnboardingInviteResponse = ApiResponse<string>;

export type CustomerOnboardingInviteStatusResponse = ApiResponse<{
	applicant_id?: string;
	is_session_active?: boolean;
}>;

export interface Stage {
	id: string;
	stage: string;
	label: string;
	priority_order: number;
}

export interface AdditionalInformationRequestPayload {
	customerId: string;
	caseId: string;
	body: {
		stages: Stage[];
		documents_required: boolean;
		subject: string;
		body: string;
	};
}

export interface RiskAlert {
	id: string;
	risk_alert_config_id: number;
	measurement_config: MinMaxMeasurementConfig | ThresholdMeasurementConfig;
	risk_level: string;
	customer_id: null;
	created_at: Date;
	created_by: string;
	updated_at: Date;
	updated_by: string;
	measurement_operation: string;
	risk_type_code: string;
	risk_sub_type_code: string;
	title: string;
	description: string;
}

export interface MinMaxMeasurementConfig {
	min: number;
	max: number;
}

export interface ThresholdMeasurementConfig {
	threshold: number;
}

export interface exportCasesResponse {
	status: string;
	message: string;
	data: exportCasesResponseData;
}

export interface exportCasesResponseData {
	file_path: string;
}

export interface GetCustomerUserResponse {
	status: string;
	message: string;
	data: {
		records: Array<{
			id: string;
			first_name: string;
			last_name: string;
			email: string;
			subrole: {
				id: string;
				code: string;
				label: string;
				display_name: string;
				description: string;
			};
		}>;
	};
}

export interface SelectAssigneeUserPayload {
	caseId: string;
	customerId: string;
	body: {
		assignee: string | null;
	};
}

export interface SelectAssigneeUserResponse {
	status: string;
	message: string;
	data: {
		message: string;
	};
}
export interface DecryptSSNPayload {
	customerId: string;
	caseId: string;
	query: {
		ownerID: string;
		businessID: string;
	};
}

export interface DecryptSSNResponse {
	status: string;
	message: string;
	data: {
		ssn: string;
	};
}

export interface CloneBusinessPayload {
	customerId: string;
	businessId: string;
	caseId: string;
	body: CloneBusinessBody;
}

export interface CloneBusinessBody {
	businessDetails: {
		name?: string;
		dba_name?: string;
		tin?: string;
		address_line_1?: string;
		address_line_2?: string;
		address_city?: string;
		address_state?: string;
		address_postal_code?: string;
		address_country?: string;
	};
	sectionsToClone?: {
		ownership?: boolean;
		banking?: boolean;
		accounting?: boolean;
		customFields?: boolean;
	};
}

export interface CloneBusinessResponse {
	status: string;
	message: string;
	data: {
		businessId: string;
		caseId: string;
	};
}

export interface CustomerApplicantConfigResponse {
	status: string;
	message: string;
	data: CustomerApplicantConfigResponseData;
}

export interface CustomerApplicantConfigResponseData {
	id: number;
	config: CustomerApplicantConfigResponseDataConfig[];
	is_enabled: boolean;
}

export interface CustomerApplicantConfigResponseDataConfig {
	message: string;
	urgency: "low" | "medium" | "high";
	threshold: number;
	allowed_case_status: number[];
}

export interface FactOverrideValue {
	value:
		| string
		| number
		| boolean
		| null
		| Record<string, unknown>
		| unknown[];
	comment: string;
}

/** Payload for patching business facts override */
export interface PatchBusinessFactsOverrideRequestPayload {
	businessId: string;
	overrides: Record<string, FactOverrideValue>;
}

/** Response from patching business facts override */
export type PatchBusinessFactsOverrideResponse = ApiResponse<{
	success: boolean;
}>;

export interface WorkflowCondition {
	name: string;
	field: string;
	description: string;
}

export interface WorkflowRuleConditions {
	failed: WorkflowCondition[];
	passed: WorkflowCondition[];
}

export interface WorkflowRuleEvaluation {
	name: string;
	matched: boolean;
	conditions?: WorkflowRuleConditions;
}

export interface WorkflowEvaluated {
	workflow_id: string;
	name: string;
	version: string;
	matched: boolean;
	rules: WorkflowRuleEvaluation[];
}

export interface WorkflowConditionsData {
	action_applied: WORKFLOW_DECISION_ENUM | string;
	decision_type: string;
	workflows_evaluated: WorkflowEvaluated[];
	generated_at: string;
}

export interface GetWorkflowConditionsRequest {
	caseId: string;
}

export type GetWorkflowConditionsResponse = ApiResponse<WorkflowConditionsData>;

/** Minimal type for workflow-service GET /customers/:customerId/workflows (used to determine "at least one workflow set up") */
export interface GetCustomerWorkflowsListResponseData {
	records: unknown[];
	total_pages: number;
	total_items: number;
}

export type GetCustomerWorkflowsListResponse =
	ApiResponse<GetCustomerWorkflowsListResponseData>;

/** Single custom field override value (matches facts override pattern) */
export interface CustomFieldOverrideValue {
	/** The new value for the field */
	value: string | number | boolean | null;
	/** Audit comment for the change */
	comment?: string;
}

/** Payload for updating custom fields (matches facts override pattern) */
export interface UpdateCustomFieldsRequestPayload {
	/** The business ID */
	businessId: string;
	/** Field overrides keyed by customer_field_id (UUID) */
	overrides: Record<string, CustomFieldOverrideValue>;
}

/** Response from updating custom fields */
export type UpdateCustomFieldsResponse = ApiResponse<{
	success: boolean;
}>;
