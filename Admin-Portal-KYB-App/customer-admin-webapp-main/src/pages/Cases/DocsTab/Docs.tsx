import React, { useMemo } from "react";
import { ArrowDownTrayIcon } from "@heroicons/react/20/solid";
import { twMerge } from "tailwind-merge";
import DocumentDoubleMinus from "@/assets/svg/DocumentDoubleMinus";
import { TitleLeftDivider } from "@/components/Dividers";
import TableLoader from "@/components/Spinner/TableLoader";
import { fileDownloader } from "@/lib/helper";
import { useGetAllDocuments } from "@/services/queries/integration.query";
import {
	type GetAllDocumentsResponse,
	type GetAllDocumentsResponseDataObject,
} from "@/types/integrations";

type Props = {
	businessId: string;
	caseId?: string;
};

const Docs = ({ businessId, caseId }: Props) => {
	const { data: allDocumentsData, isLoading: allDocumentsLoading } =
		useGetAllDocuments({
			businessId,
			caseId,
		});

	const formatData = useMemo(() => {
		if (!allDocumentsData) return null;
		return Object.keys(allDocumentsData.data)
			.map((category: keyof GetAllDocumentsResponse["data"]) => ({
				category,
				files: allDocumentsData?.data[category].map(
					(item: GetAllDocumentsResponseDataObject) => ({
						fileName: item.file_name,
						fileUrl: item.file.signedRequest,
					}),
				),
			}))
			.filter((category) => category.files.length > 0);
	}, [allDocumentsData]);

	const DocumentDownloadCards = ({
		fileObject,
	}: {
		fileObject: Array<{ fileName: string; fileUrl: string }>;
	}) => {
		return (
			<div
				className={twMerge(
					"flex justify-between border border-gray-200 rounded-xl flex-col divide-y mt-4",
				)}
			>
				{fileObject?.map((file, index) => {
					return (
						<div
							className="flex items-center justify-between h-[72px] px-6"
							key={index}
						>
							<div className="flex gap-x-[18px] items-center truncate text-wrap">
								<div className="flex items-center justify-center h-10 bg-gray-100 rounded-full min-w-10">
									<DocumentDoubleMinus />
								</div>
								{file?.fileName}
							</div>
							<div className="h-10 rounded-full cursor-pointer min-w-10 hover:bg-gray-50">
								<div
									className={twMerge(
										"flex items-center justify-center min-w-10 h-10",
									)}
									onClick={async () => {
										await fileDownloader(file?.fileUrl, file?.fileName);
									}}
								>
									<ArrowDownTrayIcon height={22} className="text-blue-600" />
								</div>
							</div>
						</div>
					);
				})}
			</div>
		);
	};

	return (
		<div>
			{allDocumentsLoading ? (
				<div className="flex justify-center py-2 tracking-tight">
					<TableLoader />
				</div>
			) : formatData?.length ? (
				<div className="mb-20">
					<div className="pt-4 text-base font-semibold">Documents</div>

					{formatData?.map((category, index) => {
						return (
							<div className="mt-6" key={index}>
								<TitleLeftDivider
									key={index}
									text={
										String(category?.category)
											.replaceAll("_", " ")
											.replace(/\b\w/g, (char) => char.toUpperCase()) ?? ""
									}
									textStyleClasses="bg-white pr-2 text-base text-gray-500"
								/>

								<DocumentDownloadCards fileObject={category?.files} />
							</div>
						);
					})}
				</div>
			) : (
				<div className="py-2 my-2 font-medium tracking-tight text-center text-red-500 ">
					No documents available.
				</div>
			)}
		</div>
	);
};

export default Docs;
