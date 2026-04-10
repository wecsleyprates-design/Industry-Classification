import { useMemo } from "react";
import { DocumentMagnifyingGlassIcon } from "@heroicons/react/24/outline";
import CaseProgressOrScore from "@/components/CaseProgressOrScore/CaseProgressOrScore";
import { UploadSkeleton } from "@/components/Skeleton";
import useGetCaseDetails from "@/hooks/useGetCaseDetails";
import { useGetAccountingUploads } from "@/services/queries/integration.query";
import { useAppContextStore } from "@/store/useAppContextStore";
import { FileDownloads, NullState } from "../../components";

import { VALUE_NOT_AVAILABLE } from "@/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";

const UploadsCard = ({
	files,
	isLoading,
}: {
	files?: Array<{ fileName: string; signedUrl: string; filePath: string }>;
	isLoading: boolean;
}) => {
	if (isLoading) return <UploadSkeleton title="Accounting Uploads" />;
	if (!files || files.length === 0) {
		return (
			<Card className="h-full pb-10 overflow-hidden">
				<NullState
					title="No Accounting Documents to Display"
					description={
						<>
							Accounting data will display here as they are added
							by <br />
							the applicant, yourself, or someone from your team.
						</>
					}
					icon={
						<DocumentMagnifyingGlassIcon className="text-[#2563EB] h-10 w-9" />
					}
				/>
			</Card>
		);
	}
	return (
		<Card className="h-full pb-10 overflow-hidden">
			<CardHeader className="flex flex-row items-center justify-between">
				<CardTitle className="text-lg">Accounting Uploads</CardTitle>
			</CardHeader>
			<CardContent>
				{files && <FileDownloads files={files} />}
			</CardContent>
		</Card>
	);
};

export interface CaseAccountingUploadTabProps {
	caseId: string;
}

export const CaseAccountingUploadTab: React.FC<
	CaseAccountingUploadTabProps
> = ({ caseId }) => {
	const { customerId } = useAppContextStore();
	const { caseData } = useGetCaseDetails({ caseId, customerId });

	const businessId = caseData?.data?.business.id ?? VALUE_NOT_AVAILABLE;

	const { data: uploadData, isLoading } = useGetAccountingUploads({
		businessId,
		caseId,
	});
	const files = useMemo(
		() =>
			uploadData?.data.map((item) => ({
				fileName: item.file_name,
				signedUrl: item.file_url,
				filePath: item.file_path,
			})),
		[uploadData],
	);

	return (
		<div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
			<div className="lg:col-span-8">
				<UploadsCard files={files} isLoading={isLoading} />
			</div>
			<div className="lg:col-span-4">
				<CaseProgressOrScore caseId={caseId} caseData={caseData} />
			</div>
		</div>
	);
};
