import {
	type CaseStatusVariant,
	type GetCasesResponse,
	type GetCaseTypesResponse,
} from "@/types/case";

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
	if (!statusLabel) return "under-manual-review";
	const normalized = statusLabel.toLowerCase().replace(" ", "-");

	return isValidStatusVariant(normalized)
		? normalized
		: "under-manual-review";
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
		"information-requested",
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
		"invited",
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
		"information-requested": "Information Requested",
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
		invited: "Invited",
	};

	const variant = getCaseStatusVariant(statusLabel);
	return labelMap[variant];
};

export const transformStatusLabel = (statusLabel: string): string => {
	return statusLabel
		.split("_")
		.map(
			(word) =>
				word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
		)
		.join(" ");
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
	data: GetCasesResponse | null,
	currentPage: number,
	itemsPerPage: number = 10,
) => {
	const totalItems = data?.data.total_items ?? 0;

	if (totalItems === 0) {
		return "No results to display";
	}

	const start = (currentPage - 1) * itemsPerPage + 1;
	const end = Math.min(
		currentPage * itemsPerPage,
		data?.data.total_items ?? 10,
	);
	return `Showing ${start}-${end} of ${totalItems} results`;
};

export const getApplicantName = (applicant?: {
	first_name?: string;
	last_name?: string;
}) => {
	if (!applicant?.first_name && !applicant?.last_name) return "-";
	return [applicant.first_name, applicant.last_name]
		.filter(Boolean)
		.join(" ");
};

export const getStatusCode = (statusLabel?: string): string | undefined => {
	const statusMap: Record<string, string> = {
		"Manually Rejected": "manually-rejected",
		"Auto Rejected": "auto-rejected",
		"Auto Approved": "auto-approved",
		"Manually Approved": "manually-approved",
		"Under Manual Review": "under-manual-review",
		"Information Requested": "information-requested",
		"Pending Decision": "pending-decision",
		Submitted: "submitted",
		"Score Generated": "score-generated",
		Archived: "archived",
		"Information Updated": "information-updated",
		Onboarding: "onboarding",
		"Risk Alert": "risk-alert",
		Investigating: "investigating",
		Dismissed: "dismissed",
		Paused: "paused",
		Escalated: "escalated",
		Created: "created",
		Invited: "invited",
	};
	return statusLabel ? statusMap[statusLabel] : undefined;
};

export const getStatusId = (statusCode: string): number | undefined => {
	const statusIdMap: Record<string, number> = {
		"manually-rejected": CASE_STATUS.MANUALLY_REJECTED,
		"auto-rejected": CASE_STATUS.AUTO_REJECTED,
		"auto-approved": CASE_STATUS.AUTO_APPROVED,
		"manually-approved": CASE_STATUS.MANUALLY_APPROVED,
		"under-manual-review": CASE_STATUS.UNDER_MANUAL_REVIEW,
		"information-requested": CASE_STATUS.INFORMATION_REQUESTED,
		"pending-decision": CASE_STATUS.PENDING_DECISION,
		submitted: CASE_STATUS.SUBMITTED,
		"score-generated": CASE_STATUS.SCORE_CALCULATED,
		archived: CASE_STATUS.ARCHIVED,
		"information-updated": CASE_STATUS.INFORMATION_UPDATED,
		onboarding: CASE_STATUS.ONBOARDING,
		"risk-alert": CASE_STATUS.RISK_ALERT,
		investigating: CASE_STATUS.INVESTIGATING,
		dismissed: CASE_STATUS.DISMISSED,
		paused: CASE_STATUS.PAUSED,
		escalated: CASE_STATUS.ESCALATED,
		invited: CASE_STATUS.INVITED,
		created: CASE_STATUS.CREATED,
	};

	return statusIdMap[statusCode];
};

export const formatSSN = (value: string | null): string => {
	if (!value) return "";
	// If already formatted with dashes (XXX-XX-XXXX), return as-is
	if (value.includes("-")) {
		return value;
	}
	// Otherwise, format the raw 9-digit SSN
	return `${value.slice(0, 3)}-${value.slice(3, 5)}-${value.slice(5, 9)}`;
};
