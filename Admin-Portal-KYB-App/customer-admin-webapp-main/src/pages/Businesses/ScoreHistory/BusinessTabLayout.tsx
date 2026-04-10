import React from "react";
import { TabComponent } from "@/components/Tabs";
import {
	Accounting,
	BankVerification,
	KnowYourBusiness,
	PublicRecordsIndex,
	Taxes,
} from "@/pages/Cases";
import BusinessCompanyProfile from "./BusinessCompanyProfile";

const BusinessTabLayout: React.FC<{
	businessId: string;
	scoreTriggerId?: string;
	caseId?: string;
}> = ({ businessId, scoreTriggerId, caseId }) => {
	const tabs: any = [
		{
			id: 1,
			name: "Company",
			content: (
				<div>
					<BusinessCompanyProfile
						businessId={businessId}
						scoreTriggerId={scoreTriggerId}
						caseId={caseId}
					/>
				</div>
			),
		},
		{
			id: 2,
			name: "KYB",
			content: (
				<div>
					<KnowYourBusiness businessId={businessId} />
				</div>
			),
		},
		{
			id: 3,
			name: "Public records",
			content: (
				<div>
					<PublicRecordsIndex
						businessId={businessId}
						scoreTriggerId={scoreTriggerId}
						bussinessHistoryPage={true}
					/>
				</div>
			),
		},
		{
			id: 4,
			name: "Banking",
			content: (
				<div>
					<BankVerification
						businessId={businessId}
						scoreTriggerId={scoreTriggerId}
					/>
				</div>
			),
		},
		{
			id: 5,
			name: "Accounting",
			content: (
				<div>
					<Accounting businessId={businessId} />
				</div>
			),
		},
		{
			id: 6,
			name: "Taxes",
			content: (
				<div>
					<Taxes businessId={businessId} scoreTriggerId={scoreTriggerId} />
				</div>
			),
		},
	];
	return (
		<div>
			<TabComponent
				tabs={tabs}
				activeId={1}
				onTabChange={function (id: number): void {}}
			/>
		</div>
	);
};

export default BusinessTabLayout;
