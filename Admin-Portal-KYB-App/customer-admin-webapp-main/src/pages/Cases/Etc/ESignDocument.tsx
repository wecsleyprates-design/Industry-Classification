import React from "react";
import {
	ArrowDownTrayIcon,
	DocumentDuplicateIcon,
} from "@heroicons/react/24/outline";
import { twMerge } from "tailwind-merge";
import { fileDownloader } from "@/lib/helper";
import { type ESignDocumentResponseData } from "@/types/case";

const ESignDocument = ({
	eSignDocument,
}: {
	eSignDocument: ESignDocumentResponseData[];
}) => {
	return (
		<div className="pt-1">
			<div className="relative mb-4">
				<div className="absolute inset-0 flex items-center" aria-hidden="true">
					<div className="w-full border-t border-gray-200" />
				</div>
				<div className="relative flex justify-start">
					<div className="pr-2 leading-6 text-gray-900 bg-white">
						<div className="flex gap-2">
							<h1 className="text-base text-gray-500">Signed Documents</h1>
						</div>
					</div>
				</div>
			</div>
			{eSignDocument?.map((signedDocument, index) => {
				return (
					<div
						className={twMerge(
							"flex justify-between px-6 py-3 border border-gray-200 rounded-xl",
							index === 0 ? "mt-[18px]" : "mt-3",
						)}
						key={index}
					>
						<div className="flex gap-x-[18px] items-center">
							<div className="flex items-center justify-center w-10 h-10 border border-gray-200 rounded-lg">
								<DocumentDuplicateIcon height={24} />
							</div>
							{signedDocument.name}
						</div>
						<div className="h-10 rounded-lg cursor-pointer min-w-10 hover:bg-gray-50 max-w-10">
							<div
								className={twMerge(
									"flex items-center justify-center w-10 h-10",
								)}
								onClick={async () => {
									await fileDownloader(
										signedDocument?.url?.signedRequest,
										`${signedDocument.name}`,
									);
								}}
							>
								<ArrowDownTrayIcon height={22} />
							</div>
						</div>
					</div>
				);
			})}
		</div>
	);
};

export default ESignDocument;
