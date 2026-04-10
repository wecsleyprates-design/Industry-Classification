import React from "react";
import { isUSCountry } from "@/lib/taxIdLabels";
import { type KYBSosFilingValue } from "@/types/integrations";
import { isDirectBusinessLink } from "../../utils/BusinessRegistrationTab";
import { SOSBadge } from "../SOSBadge";
import { SOSContent } from "./SOSContent";

import { Document } from "@/page/Cases/CaseDetails/components";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";

export interface SOSFilingCardProps {
	countryCode: string;
	sosFiling: KYBSosFilingValue | undefined;
	rows: Array<{
		label: string;
		value: React.ReactNode;
		labelTooltip?: React.ReactNode;
	}>;
	isInvalidated?: boolean;
}

export const SOSFilingCard: React.FC<SOSFilingCardProps> = ({
	countryCode,
	sosFiling,
	rows,
	isInvalidated = false,
}: SOSFilingCardProps) => {
	const usBusiness = isUSCountry(countryCode);
	const title = usBusiness
		? "Secretary of State Filings"
		: "Registration Filing";

	const documentTitle = usBusiness
		? "Articles of Incorporation"
		: "Additional Information";

	const hasDirectBusinessLink =
		sosFiling?.url && isDirectBusinessLink({ url: sosFiling.url });

	return (
		<Card>
			<div className="flex flex-col bg-white rounded-xl">
				<CardHeader className="flex flex-row items-center justify-between pb-6 space-y-0">
					<div className="flex items-center space-x-2">
						<CardTitle>{title}</CardTitle>

						<SOSBadge
							sosFiling={sosFiling}
							isInvalidated={isInvalidated}
						/>
					</div>
				</CardHeader>
				<CardContent>
					<SOSContent sosDetails={rows} />
					{hasDirectBusinessLink && (
						<div className="flex flex-col gap-2 pt-8 border-t border-gray-100">
							<span className="text-sm font-medium text-gray-500">
								Documents
							</span>
							<Document
								title={documentTitle}
								url={sosFiling.url}
							/>
						</div>
					)}
				</CardContent>
			</div>
		</Card>
	);
};
