import React from "react";
import { TinBadge } from "../TinBadge";
import type { TaxContentProps } from "./TaxContent";
import { TaxContent } from "./TaxContent";

import { CardList } from "@/page/Cases/CaseDetails/components";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";

export interface BusinessRegistrationCardProps {
	loading: boolean;
	kybFactsData: any;
	taxContentProps: TaxContentProps;
}

export const BusinessRegistrationCard: React.FC<
	BusinessRegistrationCardProps
> = ({ loading, kybFactsData, taxContentProps }) => {
	return (
		<Card>
			<div className="flex flex-col bg-white rounded-xl">
				<CardHeader className="flex flex-row items-center justify-between pb-6 space-y-0">
					<div className="flex items-center space-x-2">
						<CardTitle>Business Registration</CardTitle>
						<TinBadge
							kybFactsData={kybFactsData}
							loading={loading}
						/>
					</div>
				</CardHeader>
				<CardContent>
					<CardList>
						<TaxContent {...taxContentProps} />
					</CardList>
				</CardContent>
			</div>
		</Card>
	);
};
