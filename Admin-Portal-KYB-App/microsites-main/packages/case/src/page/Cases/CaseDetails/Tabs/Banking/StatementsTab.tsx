import React, { type FC, useMemo } from "react";
import { DocumentMagnifyingGlassIcon } from "@heroicons/react/24/outline";
import CaseProgressOrScore from "@/components/CaseProgressOrScore/CaseProgressOrScore";
import { UploadSkeleton } from "@/components/Skeleton";
import { useGetCaseDetails } from "@/hooks";
import { useGetBankingUploads } from "@/services/queries/integration.query";
import { useAppContextStore } from "@/store/useAppContextStore";
import { FileDownloads, NullState } from "../../components";

import { VALUE_NOT_AVAILABLE } from "@/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";

const StatementsCard = ({
	files,
	isLoading,
}: {
	files?: Array<{ fileName: string; signedUrl: string; filePath: string }>;
	isLoading: boolean;
}) => {
	if (isLoading) return <UploadSkeleton title="Bank Statements Uploads" />;
	if (!files || files.length === 0) {
		return (
			<Card>
				<NullState
					title="No Statements to Display"
					description={
						<>
							Bank statements display here as they are added by{" "}
							<br />
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
				<CardTitle className="text-lg">
					Bank Statements Uploads
				</CardTitle>
			</CardHeader>
			<CardContent>
				{files && <FileDownloads files={files} />}
			</CardContent>
		</Card>
	);
};

export interface StatementsTabProps {
	caseId: string;
}

export const StatementsTab: FC<StatementsTabProps> = ({ caseId }) => {
	const { customerId } = useAppContextStore();
	const { caseData } = useGetCaseDetails({ caseId, customerId });

	const businessId = caseData?.data?.business.id ?? VALUE_NOT_AVAILABLE;

	const { data: uploadData, isLoading: loadingUpload } = useGetBankingUploads(
		{
			businessId,
			caseId,
		},
	);
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
				<StatementsCard files={files} isLoading={loadingUpload} />
			</div>
			<div className="lg:col-span-4">
				<CaseProgressOrScore caseId={caseId} caseData={caseData} />
			</div>
		</div>
	);
};
