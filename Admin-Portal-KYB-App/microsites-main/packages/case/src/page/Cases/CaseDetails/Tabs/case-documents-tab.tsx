import React, { useMemo, useState } from "react";
import {
	ArrowDownTrayIcon,
	ChevronDownIcon,
	FolderIcon,
} from "@heroicons/react/24/outline";
import DocumentIcon from "@/assets/svg/DocumentIcon";
import CaseProgressOrScore from "@/components/CaseProgressOrScore/CaseProgressOrScore";
import useGetCaseDetails from "@/hooks/useGetCaseDetails";
import { useGetAllDocuments } from "@/services/queries/integration.query";
import { useAppContextStore } from "@/store/useAppContextStore";
import { type GetAllDocumentsResponseDataObject } from "@/types/integrations";

import { downloadFile } from "@/helpers/documents";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { DropdownMenu, DropdownMenuTrigger } from "@/ui/dropdown-menu";

export interface CaseDocumentsTabProps {
	caseId: string;
}

interface DocumentFile {
	id: string;
	name: string;
	downloadUrl: string;
	filePath?: string;
}

interface DocumentItemProps {
	index: number;
	document: DocumentFile;
	isFirst: boolean;
	isLast: boolean;
}

const DocumentItem: React.FC<DocumentItemProps> = ({
	index,
	document,
	isFirst,
	isLast,
}) => {
	const [loadingIndex, setLoadingIndex] = useState<number | null>(null);
	return (
		<div
			key={index}
			className={`flex items-center justify-between border border-gray-200 p-4 ${
				isFirst ? "rounded-t-lg" : ""
			} ${isLast ? "rounded-b-lg" : ""}`}
		>
			<div className="flex items-center gap-3 truncate">
				<span className="flex items-center justify-center w-10 h-10 bg-gray-100 rounded-full">
					<DocumentIcon />
				</span>
				<span className="text-sm truncate" title={document.name}>
					{document.name}
				</span>
			</div>
			<Button
				variant="ghost"
				size="sm"
				aria-label="Download document"
				onClick={async () => {
					setLoadingIndex(index);
					try {
						await downloadFile(
							document.downloadUrl,
							document.name,
							document.filePath,
						);
					} finally {
						setLoadingIndex(null);
					}
				}}
				disabled={loadingIndex === index}
				className="p-2 rounded-full"
			>
				{loadingIndex === index ? (
					<span className="animate-spin size-4 border-[3px] border-blue-600 border-t-transparent rounded-full" />
				) : (
					<>
						<ArrowDownTrayIcon className="w-5 h-5 text-blue-600" />
						<span className="sr-only">Download</span>
					</>
				)}
			</Button>
		</div>
	);
};

const EmptyState: React.FC = () => {
	return (
		<div className="flex flex-col items-center justify-center py-12 text-center">
			<div className="p-3 mb-4 bg-gray-100 rounded-full">
				<FolderIcon className="w-6 h-6 text-gray-400" />
			</div>
			<h3 className="mb-1 text-lg font-medium text-gray-900">
				No Documents Found
			</h3>
			<p className="max-w-sm text-sm text-gray-500">
				We couldn't find any documents associated with this case.
			</p>
		</div>
	);
};

const formatCategory = (category: string) =>
	category.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

export const CaseDocumentsTab: React.FC<CaseDocumentsTabProps> = ({
	caseId,
}) => {
	const { customerId } = useAppContextStore();
	const { caseData } = useGetCaseDetails({ caseId, customerId });

	const businessId = caseData?.data?.business.id ?? "";
	const businessName = caseData?.data?.business?.name ?? "";
	const { data: allDocumentsData, isLoading: allDocumentsLoading } =
		useGetAllDocuments({
			businessId,
			caseId,
		});

	const categorizedDocuments = useMemo(() => {
		const result: Record<string, DocumentFile[]> = {};
		if (!allDocumentsData?.data) return result;

		for (const category in allDocumentsData.data) {
			const docs = allDocumentsData.data[category];
			if (docs && docs.length > 0) {
				result[category] = docs.map(
					(doc: GetAllDocumentsResponseDataObject) => ({
						id: doc.ocr_document_id ?? doc.file_name,
						name: doc.file_name,
						downloadUrl: doc.file.signedRequest,
						filePath: doc?.file_path,
					}),
				);
			}
		}
		return result;
	}, [allDocumentsData]);

	return (
		<div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
			<div className="flex flex-col col-span-1 gap-4 lg:col-span-7">
				<Card className="h-full overflow-hidden">
					<CardHeader className="flex flex-row items-center justify-between">
						<CardTitle className="text-lg">Documents</CardTitle>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="outline"
									className="flex items-center gap-1"
									disabled
								>
									{businessName}{" "}
									<ChevronDownIcon className="w-4 h-4" />
								</Button>
							</DropdownMenuTrigger>
							{/* TODO: Will be expanded later for user documents */}
						</DropdownMenu>
					</CardHeader>
					<CardContent>
						{allDocumentsLoading ? (
							<div className="space-y-2">
								{Array.from({ length: 4 }).map((_, idx) => (
									<div
										key={idx}
										className="h-10 bg-gray-100 rounded-md animate-pulse"
									/>
								))}
							</div>
						) : Object.keys(categorizedDocuments).length > 0 ? (
							<div className="divide-y divide-gray-100">
								{Object.entries(categorizedDocuments)
									.sort((a, b) => a[0].localeCompare(b[0]))
									.map(([category, docs]) => (
										<div
											key={category}
											className="grid grid-cols-12 py-6 gap-x-6 first:pt-0 last:pb-0"
										>
											<div className="col-span-4 pt-2 text-sm text-gray-500">
												{formatCategory(category)}
											</div>
											<div className="col-span-8 space-y-[-1px]">
												{docs.map((doc, index) => (
													<DocumentItem
														key={index}
														index={index}
														document={doc}
														isFirst={index === 0}
														isLast={
															index ===
															docs.length - 1
														}
													/>
												))}
											</div>
										</div>
									))}
							</div>
						) : (
							<EmptyState />
						)}
					</CardContent>
				</Card>
			</div>
			<div className="flex flex-col col-span-1 gap-4 lg:col-span-5">
				<CaseProgressOrScore caseId={caseId} caseData={caseData} />
			</div>
		</div>
	);
};
