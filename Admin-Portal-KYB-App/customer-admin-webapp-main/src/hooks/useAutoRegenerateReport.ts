import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import type { ReportStatus } from "@/types/report";

interface Params {
	businessId: string;
	caseId?: string;
	customerId: string;
	generateReport: (args: {
		customerId: string;
		businessId: string;
		caseId?: string;
	}) => Promise<unknown>;
	isRegenerating: boolean;
	setIsRegenerating: (v: boolean) => void;
	reportStatus?: ReportStatus;
}

// Automatically triggers generateReport when ?regenerateReport=1 is present in the URL.
export default function useAutoRegenerateReport({
	businessId,
	caseId,
	customerId,
	generateReport,
	isRegenerating,
	setIsRegenerating,
	reportStatus,
}: Params) {
	const location = useLocation();
	const navigate = useNavigate();

	useEffect(() => {
		const params = new URLSearchParams(location.search);
		const shouldRegenerate = params.get("regenerateReport") === "1";

		if (!shouldRegenerate || isRegenerating || !businessId) return;

		// Use a sessionStorage key to remember in-progress generations across reloads.
		const generationKey = `reportGenerating-${businessId}-${caseId ?? "case"}`;
		const alreadyGenerating = sessionStorage.getItem(generationKey) === "1";
		if (alreadyGenerating) return;

		// Mark as generating.
		sessionStorage.setItem(generationKey, "1");

		setIsRegenerating(true);
		generateReport({ businessId, caseId, customerId })
			.catch(() => {
				// Clear the generation flag if generation fails, so user can retry.
				sessionStorage.removeItem(generationKey);
			})
			.finally(() => {
				setIsRegenerating(false);
			});

		// Strip the query param so refreshes do not retrigger.
		params.delete("regenerateReport");
		navigate(
			{ pathname: location.pathname, search: params.toString() },
			{ replace: true },
		);
	}, [businessId, location.search]);

	// Clear the session flag when the report status leaves the pending range.
	useEffect(() => {
		if (!businessId) return;
		const key = `reportGenerating-${businessId}-${caseId ?? "case"}`;

		const PENDING: ReportStatus[] = [
			"REQUESTED",
			"IN_PROGRESS",
			"REGENERATION_IN_PROGRESS",
		];

		if (
			sessionStorage.getItem(key) === "1" &&
			reportStatus &&
			!PENDING.includes(reportStatus)
		) {
			sessionStorage.removeItem(key);
		}
	}, [reportStatus, businessId, caseId]);
}
