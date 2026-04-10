import { type ModuleType } from "@/store/useAppContextStore";
import { type ApiResponse } from "@/types/api";

export type ReportStatus =
	| "COMPLETED"
	| "REQUESTED"
	| "IN_PROGRESS"
	| "FAILED"
	| "REGENERATED_SUCCESSFULLY"
	| "REGENERATION_IN_PROGRESS"
	| "DOWNLOAD_REPORT_AVAILABLE"
	| "DOWNLOAD_REPORT_UNAVAILABLE"
	| "FAILED_SECOND_TIME";

export type ReportStatusType = ApiResponse<{
	status: ReportStatus;
	report_details?: ReportStatusData;
}>;

export interface ReportStatusData {
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

export interface GenerateReportRequestBody {
	customerId: string;
	businessId: string;
	moduleType: ModuleType;
	caseId?: string;
}

export type DownloadReportType = ApiResponse<DownloadReportData>;

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

export interface BulkReportStatusResponse {
	status: string;
	message: string;
	data: BulkReportStatusData;
}

export interface BulkReportStatusData {
	report_statuses: BulkReportStatus[];
	status: ReportStatus;
}

export interface BulkReportStatus {
	status: string;
	business_id: string;
	row_num: string;
	report_status: string;
	previous_status: null;
	final_status: string;
}
