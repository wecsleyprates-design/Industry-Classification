import { type UUID } from "crypto";
import { type Maybe } from "yup";
import { type IPayload } from "./common";
import { type AdverseMediaResponseDataArticle } from "./publicRecords";

export interface ICaseForm {
	firstName: string;
	lastName: string;
	email: string;
	mobile?: Maybe<string | undefined>;
	companyName: string;
	companyMobile?: Maybe<string | undefined>;
}

export interface ICaseFormBoolean {
	firstName?: boolean | undefined;
	lastName?: boolean | undefined;
	email?: boolean | undefined;
	mobile?: boolean | undefined;
	companyName?: boolean | undefined;
	companyMobile?: boolean | undefined;
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

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

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
	articles: AdverseMediaResponseDataArticle[];
	allArticles: AdverseMediaResponseDataArticle[];
	riskLevel: RiskLevel;
}
export interface GetCasesRequest {
	customerId: string;
	params: IPayload;
}

export interface GetCaseseResponseBody {
	status: string;
	message: string;
	data: {
		records: [
			{
				id: string;
				user_id: string;
				created_at: string;
				company_name: string;
				status_code: string;
				applicant: {
					first_name: string;
					last_name: string;
				};
				status: {
					id: number;
					code: string;
				};
			},
		];
		total_pages: number;
		total_items: string;
	};
}
export interface TableDataType {
	records: [
		{
			id: string;
			user_id: string;
			created_at: string;
			company_name: string;
			status_code: string;
			applicant: {
				first_name: string;
				last_name: string;
			};
			status: {
				id: number;
				code: string;
			};
		},
	];
	total_pages: number;
	total_items: string;
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

export interface GetCaseseByIdResponseBody {
	status: string;
	message: string;
	data: any;
}

export interface SendInvitationPayload {
	customerId: string;
	payload: PostSendInvitationBody;
}

export interface PostSendInvitationBody {
	existing_business?: {
		business_id?: string;
		name?: string;
		is_quick_add?: boolean;
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
	custom_fields?: any;
	is_no_login?: boolean;
	skip_credit_check?: boolean;
}

export interface IStatusUpdateForm {
	status: string;
	assignee?: string;
	comment?: string;
}

export interface UpdateCase {
	newStatus: string;
	userId: string;
	caseId: string;
}

export interface ArchiveCaseBody {
	caseId: string;
	customerId: string;
	body: {
		status: string;
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

export interface GetCustomerOnboardingStagesResponse {
	status: string;
	message: string;
	data: Stage[];
}

export interface Stage {
	stage_id: UUID;
	stage: string;
	stage_code: string;
	completion_weightage: number;
	is_enabled: boolean;
	is_skippable: boolean;
	is_orderable: boolean;
	is_removable: boolean;
	allow_back_nav: boolean;
	next_stage: UUID;
	prev_stage: UUID;
	priority_order: number;
	config: {
		fields: StageConfigItem[];
		integrations: StageConfigItem[];
		additional_settings: StageConfigItem[];
	};
	settingsCount?: number;
}

export interface StageConfigItem {
	name: string;
	status?: string | boolean;
	description?: string;
	status_data_type?: "Boolean" | "Dropdown" | "Toggle" | "Checkbox";
	section_name?: string;
	is_enabled?: boolean;
	sub_fields?: StageConfigSubField[];
}

export interface StageConfigSubField {
	name: string;
	description?: string;
	is_enabled?: boolean;
	status?: string | boolean;
	status_data_type:
		| "Boolean"
		| "Dropdown"
		| "Toggle"
		| "Checkbox"
		| "Template"
		| "Textbox";
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
		| "post_submission_editing_setup"
		| "international_business_setup";
	label: string;
}

export interface StageName {
	id: string;
	stage: string;
	label: string;
	priority_order: number;
}

export interface AdditionalInformationRequest {
	customerId: string;
	caseId: string;
	payload: {
		stages: StageName[];
		documents_required: boolean;
		subject: string;
		body: string;
		applicant?: {
			first_name: string;
			last_name: string;
			email: string;
		};
	};
}

export interface ESignDocumentPayload {
	businessId: string;
	caseId: string;
}

export interface ESignDocumentsResponse {
	status: string;
	message: string;
	data: ESignDocumentResponseData[];
}

export interface ESignDocumentResponseData {
	document_id: string;
	template_id: string;
	customer_id: string;
	business_id: string;
	case_id: string;
	signed_by: string;
	mapping_data: null;
	created_at: Date;
	created_by: string;
	updated_at: Date;
	updated_by: string;
	name: string;
	url: ESignDocumentResponseDataURL;
}

export interface ESignDocumentResponseDataURL {
	fileName: string;
	signedRequest: string;
	url: string;
}

export interface CustomerOnboardingInvitePayload {
	customerId: string;
	caseId: string;
}

export interface CustomerOnboardingInviteResponse {
	status: string;
	message: string;
	data: string;
}

export interface CustomerOnboardingInviteStatusResponse {
	status: string;
	message: string;
	data: { applicant_id?: string; is_session_active?: boolean };
}

export interface ESignTemplateResponse {
	status: string;
	message: string;
	data: ESignTemplateResponseData[];
}

export interface ESignTemplateResponseData {
	template_id: string;
	is_selected?: boolean;
	url: ESignTemplateResponseDataURL;
	name: string;
	tags: string[];
}

export interface ESignTemplateResponseDataURL {
	fileName: string;
	signedRequest: string;
	url: string;
}
