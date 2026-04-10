import TableLoader from "@/components/Spinner/TableLoader";
import TabsWithButton from "@/components/Tabs/TabsWithButton";
import { useGetESignDocument } from "@/services/queries/case.query";
import { useGetProcessingHistory } from "@/services/queries/integration.query";
import ESignDocument from "./ESignDocument";
import ProcessingHistory from "./ProcessingHistory";

const Etc = ({
	businessId,
	caseId,
}: {
	businessId: string;
	caseId: string;
}) => {
	const { data: eSignDocumentsData, isLoading: eSignDocumentLoading } =
		useGetESignDocument({
			businessId,
			caseId,
		});

	const { data: processingHistoryData, isLoading: processingHistoryLoading } =
		useGetProcessingHistory(businessId, caseId);

	const tabs = [
		...(eSignDocumentsData?.data?.length
			? [
					{
						key: "signed-documents",
						id: 0,
						name: "Signed Documents",
						content: <ESignDocument eSignDocument={eSignDocumentsData?.data} />,
					},
				]
			: []),
		...(processingHistoryData?.data?.length
			? [
					{
						key: "processing-history",
						id: 1,
						name: "Processing History",
						content: (
							<ProcessingHistory
								processingHistory={processingHistoryData}
								businessId={businessId}
							/>
						),
					},
				]
			: []),
	];

	return (
		<div>
			{processingHistoryLoading || eSignDocumentLoading ? (
				<div className="flex justify-center py-2 tracking-tight">
					<TableLoader />
				</div>
			) : (
				<TabsWithButton
					tabs={tabs}
					onTabChange={(id: number): void => {}}
					hideSingleTab={tabs?.length === 1}
				/>
			)}
		</div>
	);
};

export default Etc;
