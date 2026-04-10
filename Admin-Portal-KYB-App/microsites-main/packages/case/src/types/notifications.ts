import { type IPayload } from "./common";

export interface GetEmailConfig {
	status: string;
	message: string;
	data: EmailConfigObject[];
}

export interface EmailConfigObject {
	id: string;
	customer_id: string;
	notification_type: 1;
	is_enabled: boolean;
	created_at: string;
	created_by: string;
	updated_at: string;
	updated_by: string;
	type_id: number;
	code: string;
	label: string;
	config: {
		id: string;
		code: string;
		label: string;
	};
}

export interface UpdateEmailConfigBody {
	configs: Array<{
		customer_id: string;
		notification_code: string;
		is_enabled: boolean;
	}>;
}
export interface GetAuditTrailActionsResponse {
	status: string;
	message: string;
	data: GetAuditTrailActionsData[];
}

export interface GetAuditTrailActionsData {
	id: number;
	code: string;
	label: string;
}

export interface GetAuditTrailPayload {
	businessID: string;
	params?: IPayload;
}

export interface GetAuditTrailResponse {
	status: string;
	message: string;
	data: GetAuditTrailData;
}

export interface GetAuditTrailData {
	records: GetAuditTrailDataRecord[];
	total_pages: number;
	total_items: number;
	page: number;
}

interface FileDetails {
	fileName: string;
	signedRequest: string;
	url: string;
}

export interface GetAuditTrailDataRecord {
	id: string;
	case_id: string;
	event_id: number;
	template: string;
	metadata: Metadata;
	message: string;
	is_edited: boolean;
	id_deleted: boolean;
	created_at: string;
	created_by: string | null;
	updated_at: string;
	updated_by: string | null;
	business_id: string;
	action: Action;
	to_be_hyperlinked: string[];
	to_be_bold: string[];
	attachments?: Array<{
		file_name: string;
		file_details: FileDetails;
	}>;
}

export interface Action {
	id: number;
	code: string;
	label: string;
}

export interface Metadata {
	case_id: string;
	business_id: string;
	business_name: string;
	worth_score?: number;
	applicant_id?: string;
	applicant_name?: string;
	customer_user_name?: string;
}
