import React, { useState } from "react";
import { ArrowDownTrayIcon, DocumentIcon } from "@heroicons/react/24/outline";
import { api } from "@/lib/api";
import { type IdentityDocument } from "@/types/businessEntityVerification";

import MICROSERVICE from "@/constants/Microservices";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";

interface IdentityDocumentsProps {
	documents: IdentityDocument[];
	businessId: string;
	ownerId: string;
	caseId: string;
}

export const IdentityDocuments: React.FC<IdentityDocumentsProps> = ({
	documents,
	businessId,
	ownerId,
	caseId,
}) => {
	const [downloadingStates, setDownloadingStates] = useState<
		Record<string, boolean>
	>({});

	const handleDocumentDownload = async (
		documentType: string,
		side: "front" | "back",
		docIndex: number,
	) => {
		const loadingKey = `${docIndex}-${side}`;
		setDownloadingStates((prev) => ({ ...prev, [loadingKey]: true }));

		try {
			const downloadUrl = `${
				MICROSERVICE.INTEGRATION
			}/verification/businesses/${businessId}/applicant/${ownerId}/document/download?type=${encodeURIComponent(
				documentType,
			)}&side=${side}&case_id=${caseId}`;

			const response = await api.get(downloadUrl, {
				responseType: "blob",
			});

			const blob = new Blob([response.data], {
				type: response.headers["content-type"] || "image/jpeg",
			});
			const blobUrl = URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.href = blobUrl;
			link.download = `${caseId}_${documentType.replace(
				/\s+/g,
				"_",
			)}_${side}.jpg`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);

			URL.revokeObjectURL(blobUrl);
		} catch (error) {
			console.error("Failed to download document:", error);
		} finally {
			setDownloadingStates((prev) => ({ ...prev, [loadingKey]: false }));
		}
	};

	if (documents.length === 0) {
		return null;
	}

	return (
		<div className="mt-6">
			<h3 className="text-lg font-medium text-gray-900 mb-2">
				Documents
			</h3>
			<div className="divide-y divide-gray-200">
				{documents.map((doc, index) => {
					const documentStatus =
						doc.status === "success" || doc.status === "passed"
							? "match"
							: (doc.status ?? "pending");
					const badgeVariant =
						documentStatus === "match"
							? "success"
							: documentStatus === "failed"
								? "destructive"
								: "secondary";
					const documentType = doc.type ?? "Identity Document";

					return (
						<React.Fragment key={index}>
							{doc.original_front_url && (
								<div className="py-4 flex items-center justify-between">
									<div className="flex items-center space-x-2">
										<DocumentIcon className="w-5 h-5 text-gray-400" />
										<span className="text-sm font-medium">
											{documentType} (Front)
										</span>
										<Badge variant={badgeVariant as any}>
											{documentStatus}
										</Badge>
									</div>
									<Button
										variant="outline"
										size="sm"
										onClick={async () => {
											await handleDocumentDownload(
												documentType,
												"front",
												index,
											);
										}}
										disabled={
											downloadingStates[`${index}-front`]
										}
									>
										{downloadingStates[`${index}-front`] ? (
											<span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
										) : (
											<ArrowDownTrayIcon className="w-4 h-4" />
										)}
										<span className="sr-only">
											Download Front
										</span>
									</Button>
								</div>
							)}
							{doc.original_back_url && (
								<div className="py-4 flex items-center justify-between">
									<div className="flex items-center space-x-2">
										<DocumentIcon className="w-5 h-5 text-gray-400" />
										<span className="text-sm font-medium">
											{documentType} (Back)
										</span>
										<Badge variant={badgeVariant as any}>
											{documentStatus}
										</Badge>
									</div>
									<Button
										variant="outline"
										size="sm"
										onClick={async () => {
											await handleDocumentDownload(
												documentType,
												"back",
												index,
											);
										}}
										disabled={
											downloadingStates[`${index}-back`]
										}
									>
										{downloadingStates[`${index}-back`] ? (
											<span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
										) : (
											<ArrowDownTrayIcon className="w-4 h-4" />
										)}
										<span className="sr-only">
											Download Back
										</span>
									</Button>
								</div>
							)}
						</React.Fragment>
					);
				})}
			</div>
		</div>
	);
};
