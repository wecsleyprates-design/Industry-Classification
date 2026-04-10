import { envConfig } from "./env.config";
import { type ExportConfig } from "#core/audit/types";

export const exportConfig: ExportConfig = {
	maxRecords: envConfig.EXPORT_MAX_RECORDS,
	filenames: {
		executionLogs: "workflow_execution_logs",
		workflowChangesLogs: "workflow_changes_logs"
	}
};
