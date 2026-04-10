import React from "react";

import { Document } from "@/page/Cases/CaseDetails/components";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";

export interface ShareholderDocumentCardProps {
	document: {
		id: string;
		url: string;
		fileName: string;
	};
}

export const ShareholderDocumentCard: React.FC<
	ShareholderDocumentCardProps
> = ({ document }) => {
	return (
		<Card>
			<div className="flex flex-col bg-white rounded-xl">
				<CardHeader className="flex flex-row items-center justify-between pb-6 space-y-0">
					<CardTitle>Shareholder Section</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="flex flex-col gap-2">
						<span className="text-sm font-medium text-gray-500">
							Documents
						</span>
						<Document
							title={"Shareholder Document"}
							url={document.url}
						/>
					</div>
				</CardContent>
			</div>
		</Card>
	);
};
