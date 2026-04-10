export type ReportStatus =
	| "COMPLETED"
	| "REGENERATED_SUCCESSFULLY"
	| "REQUESTED"
	| "IN_PROGRESS"
	| "REGENERATION_IN_PROGRESS"
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

export interface BulkReportStatusResponse {
	status: string;
	message: string;
	data: Data;
}

export interface Data {
	report_statuses: IReportStatus[];
	status: ReportStatus;
}

export interface IReportStatus {
	status: string;
	business_id: string;
	row_num: string;
	report_status: string;
	previous_status: null;
	final_status: string;
}
