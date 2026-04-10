import {
	type CaseStatusVariant,
	type GetCasesResponse,
	type GetCaseTypesResponse,
} from "@/lib/types/case";

import { CASE_STATUS } from "@/constants/case-status";

export const isValidCaseData = (data: unknown): data is GetCasesResponse => {
	return (
		typeof data === "object" &&
		data !== null &&
		(data as any).status === "success" &&
		Array.isArray((data as any).data?.records) &&
		(data as any).data.records.length > 0
	);
};

export const isValidCaseTypesData = (
	data: unknown,
): data is GetCaseTypesResponse => {
	return (
		typeof data === "object" &&
		data !== null &&
		(data as any).status === "success" &&
		Array.isArray((data as any).data?.records)
	);
};

export const getCaseTypeBadge = (
	caseTypeId: number,
	caseTypes: GetCaseTypesResponse["data"]["records"] = [],
) => {
	const caseType = caseTypes.find((type) => type.id === caseTypeId);
	const label = caseType?.label?.toLowerCase() ?? "";

	switch (label) {
		case "risk":
			return "Risk";
		case "application edit":
		case "application_edit":
			return "Application Edit";
		case "onboarding":
			return "Onboarding";
		default:
			return caseType?.label ?? "-";
	}
};

export const getCaseStatusVariant = (
	statusLabel?: string,
): CaseStatusVariant => {
	if (!statusLabel) return "needs-review";
	const normalized = statusLabel.toLowerCase().replace(" ", "-");
	return isValidStatusVariant(normalized) ? normalized : "needs-review";
};

export const isValidStatusVariant = (
	status: string,
): status is CaseStatusVariant => {
	const validVariants: CaseStatusVariant[] = [
		"manually-rejected",
		"auto-rejected",
		"auto-approved",
		"manually-approved",
		"under-manual-review",
		"info-requested",
		"pending-decision",
		"submitted",
		"score-generated",
		"created",
		"archived",
		"information-updated",
		"onboarding",
		"risk-alert",
		"investigating",
		"dismissed",
		"paused",
		"escalated",
	];
	return validVariants.includes(status as CaseStatusVariant);
};

export const getStatusLabel = (statusLabel?: string): string => {
	const labelMap: Record<CaseStatusVariant, string> = {
		"manually-rejected": "Manually Rejected",
		"auto-rejected": "Auto Rejected",
		"auto-approved": "Auto Approved",
		"manually-approved": "Manually Approved",
		"under-manual-review": "Under Manual Review",
		"info-requested": "Info Requested",
		"pending-decision": "Pending Decision",
		submitted: "Submitted",
		"score-generated": "Score Generated",
		created: "Created",
		archived: "Archived",
		"information-updated": "Information Updated",
		onboarding: "Onboarding",
		"risk-alert": "Risk Alert",
		investigating: "Investigating",
		dismissed: "Dismissed",
		paused: "Paused",
		escalated: "Escalated",
		"needs-review": "Needs Review",
	};

	const variant = getCaseStatusVariant(statusLabel);
	return labelMap[variant];
};

export const getTotalPages = (
	hasValidData: boolean,
	current: GetCasesResponse | undefined,
	last: GetCasesResponse | null,
): number => {
	if (hasValidData && current) return current.data.total_pages;
	if (last) return last.data.total_pages;
	return 1;
};

export const getResultsDisplay = (
	data: GetCasesResponse,
	currentPage: number,
	itemsPerPage: number = 10,
) => {
	const start = (currentPage - 1) * itemsPerPage + 1;
	const end = Math.min(
		currentPage * itemsPerPage,
		parseInt(data.data.total_items),
	);
	return `Showing ${start}-${end} of ${parseInt(
		data.data.total_items,
	)} results`;
};

export const getApplicantName = (applicant?: {
	first_name?: string;
	last_name?: string;
}) => {
	if (!applicant?.first_name && !applicant?.last_name) return "-";
	return [applicant.first_name, applicant.last_name].filter(Boolean).join(" ");
};

export const getStatusCode = (statusLabel?: string): string | undefined => {
	const statusMap: Record<string, string> = {
		"Manually Rejected": "manually-rejected",
		"Auto Rejected": "auto-rejected",
		"Auto Approved": "auto-approved",
		"Manually Approved": "manually-approved",
		"Needs Review": "needs-review",
		"Info Requested": "info-requested",
		"Pending Decision": "pending-decision",
		Submitted: "submitted",
		"Score Generated": "score-generated",
		Created: "created",
		Archived: "archived",
		"Information Updated": "information-updated",
		Onboarding: "onboarding",
		"Risk Alert": "risk-alert",
		Investigating: "investigating",
		Dismissed: "dismissed",
		Paused: "paused",
	};

	return statusLabel ? statusMap[statusLabel] : undefined;
};

export const getStatusId = (statusCode: string): number | undefined => {
	const statusIdMap: Record<string, number> = {
		"manually-rejected": CASE_STATUS.MANUALLY_REJECTED,
		"auto-rejected": CASE_STATUS.AUTO_REJECTED,
		"auto-approved": CASE_STATUS.AUTO_APPROVED,
		"manually-approved": CASE_STATUS.MANUALLY_APPROVED,
		"needs-review": CASE_STATUS.UNDER_MANUAL_REVIEW,
		"info-requested": CASE_STATUS.INFORMATION_REQUESTED,
		"pending-decision": CASE_STATUS.PENDING_DECISION,
		submitted: CASE_STATUS.SUBMITTED,
		"score-generated": CASE_STATUS.SCORE_CALCULATED,
		created: CASE_STATUS.ONBOARDING,
		archived: CASE_STATUS.ARCHIVED,
		"information-updated": CASE_STATUS.INFORMATION_UPDATED,
		onboarding: CASE_STATUS.ONBOARDING,
		"risk-alert": CASE_STATUS.RISK_ALERT,
		investigating: CASE_STATUS.INVESTIGATING,
		dismissed: CASE_STATUS.DISMISSED,
		paused: CASE_STATUS.PAUSED,
	};

	return statusIdMap[statusCode];
};
