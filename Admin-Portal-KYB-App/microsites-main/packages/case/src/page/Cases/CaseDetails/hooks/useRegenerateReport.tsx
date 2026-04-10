import { toast } from "sonner";
import {
	useGenerateReport,
	useGetBusinessReportStatus,
} from "@/services/queries/report.query";
import { useAppContextStore } from "@/store/useAppContextStore";
import { type CaseData } from "@/types/case";

export function useRegenerateReport(caseData?: CaseData) {
	const { moduleType } = useAppContextStore();
	const { mutateAsync: generateReport, isPending: isLoading } =
		useGenerateReport();

	const { refetch: refetchBusinessReportStatus } = useGetBusinessReportStatus(
		{
			businessId: caseData?.business_id ?? "",
			caseId: caseData?.id,
		},
	);

	const regenerateReport = async () => {
		try {
			await generateReport({
				customerId: caseData?.customer_id ?? "",
				businessId: caseData?.business_id ?? "",
				caseId: caseData?.id,
				moduleType,
			});
			toast.success("Report regeneration in progress");
			await refetchBusinessReportStatus();
		} catch (error) {
			toast.error("Error regenerating report");
			throw error;
		}
	};

	return { regenerateReport, isLoading };
}

export default useRegenerateReport;
