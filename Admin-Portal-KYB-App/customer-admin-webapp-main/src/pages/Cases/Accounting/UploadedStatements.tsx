import React, { type FC, useMemo } from "react";
import {
	ArrowDownTrayIcon,
	DocumentTextIcon,
} from "@heroicons/react/24/outline";
import TableLoader from "@/components/Spinner/TableLoader";
import { useGetAccountingUploads } from "@/services/queries/integration.query";

interface Props {
	businessId: string;
	caseId?: string;
}

const UploadedStatements: FC<Props> = ({ businessId, caseId }) => {
	const { data: uploadData, isLoading: loading } = useGetAccountingUploads({
		businessId,
		caseId,
	});

	const uploadedStatementsData = useMemo(() => uploadData?.data, [uploadData]);
	return (
		<>
			<div className="w-full p-6 pt-2 mt-8 mb-8 bg-white border rounded-lg shadow">
				<h2 className="mb-4 text-lg font-semibold text-gray-900">Uploads</h2>
				{uploadedStatementsData && uploadedStatementsData?.length > 0 && (
					<div className="my-4 space-y-2">
						{uploadData?.data?.map((item, index) => (
							<div
								key={index}
								className="flex items-center justify-between p-4 bg-transparent border border-gray-200 rounded-lg"
							>
								<div className="flex items-center gap-2">
									<DocumentTextIcon className="p-1 text-gray-600 bg-gray-100 rounded-lg size-7" />
									<p className="text-sm text-gray-600">{item?.file_name}</p>
								</div>
								<ArrowDownTrayIcon
									className="p-1 text-blue-600 rounded-lg cursor-pointer size-7 hover:bg-gray-100"
									onClick={async () => {
										if (item?.file_url) {
											window.open(item?.file_url, "_blank");
										}
									}}
								/>
							</div>
						))}
					</div>
				)}
				{!uploadedStatementsData?.length && (
					<div
						style={{ display: "flex", justifyContent: "center" }}
						className="py-2 mt-5 text-base font-normal tracking-tight text-center text-gray-500"
					>
						{loading ? <TableLoader /> : "Data not found"}
					</div>
				)}
			</div>
		</>
	);
};

export default UploadedStatements;
