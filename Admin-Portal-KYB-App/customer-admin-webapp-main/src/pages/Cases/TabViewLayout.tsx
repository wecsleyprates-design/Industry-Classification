import React, { type ReactElement, useEffect, useState } from "react";
import TabComponent from "@/components/Tabs/TabsWithUnderline";
import { type BusinessEntityVerificationResponse } from "@/types/businessEntityVerification";
import { type ESignDocumentResponseData } from "@/types/case";
import {
	type BusinessWebsiteResponse,
	type GetProcessingStatementsResponse,
} from "@/types/integrations";
import { type PublicRecordsResponse } from "@/types/publicRecords";
import Insights from "../Insights";
import Accounting from "./Accounting/Accounting";
import Docs from "./DocsTab/Docs";
import PublicRecordsIndex from "./PublicRecords/PublicRecordsIndex";
import Taxes from "./Taxes/Taxes";
import BankVerification from "./Banking";
import CompanyProfile from "./CompanyProfile";
import Etc from "./Etc";
import KnowYourBusiness from "./KnowYourBusiness";
import ViewCustomFields from "./ViewCustomFields";

/** Banking tab id in this layout (used for case tab values row navigation). */
export const BANKING_TAB_ID = 4;

interface IViewTabLayoutProps {
	applicantData: Record<string, any>;
	publicRecords?: PublicRecordsResponse;
	businessWebsiteData?: BusinessWebsiteResponse;
	businessVerificationDetails?: BusinessEntityVerificationResponse;
	incomeData?: any;
	loadingIncome?: boolean;
	processingHistory?: GetProcessingStatementsResponse;
	eSignDocumentsData?: ESignDocumentResponseData[];
	/** When provided, controls which tab is active (e.g. for row-click navigation to Banking). */
	activeTabId?: number;
	onTabChange?: (tabId: number) => void;
}

const ViewTabLayout: React.FC<IViewTabLayoutProps> = ({
	applicantData,
	businessVerificationDetails,
	incomeData,
	loadingIncome,
	processingHistory,
	publicRecords,
	eSignDocumentsData,
	activeTabId = 1,
	onTabChange,
}) => {
	const [tabs, setTabs] = useState<
		Array<{ id: number; name: string; content: ReactElement<any, any> }>
	>([]);

	useEffect(() => {
		setTabs([
			{
				id: 1,
				name: "Company",
				content: (
					<div>
						<CompanyProfile
							caseId={applicantData?.id}
							businessId={applicantData?.business?.id}
							businessVerificationDetails={businessVerificationDetails}
							publicRecords={publicRecords}
						/>
					</div>
				),
			},
			{
				id: 2,
				name: "KYB",
				content: (
					<div>
						<KnowYourBusiness
							businessId={applicantData?.business?.id ?? null}
							countryCode={applicantData?.business?.address_country ?? null}
						/>
					</div>
				),
			},
			{
				id: 3,
				name: "Public records",
				content: (
					<div>
						<PublicRecordsIndex
							caseId={applicantData?.id}
							businessId={applicantData?.business?.id}
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
							businessId={applicantData?.business?.id}
							caseId={applicantData?.id}
						/>
					</div>
				),
			},
			{
				id: 5,
				name: "Accounting",
				content: (
					<div>
						<Accounting
							businessId={applicantData?.business?.id ?? ""}
							caseId={applicantData?.id}
						/>
					</div>
				),
			},
			{
				id: 6,
				name: "Taxes",
				content: (
					<div>
						<Taxes
							businessId={applicantData?.business?.id ?? ""}
							caseId={applicantData?.id}
						/>
					</div>
				),
			},
			{
				id: 10,
				name: "Docs",
				content: (
					<div>
						<Docs
							businessId={applicantData?.business?.id ?? ""}
							caseId={applicantData?.id}
						/>
					</div>
				),
			},
		]);

		// Add custome fields tab only if invitee case or custom fields set by the customer
		if (applicantData.customer_id && applicantData?.custom_fields) {
			setTabs((prev) => {
				const element = prev.find((item) => item.id === 8);
				if (!element)
					prev.push({
						id: 8,
						name: "Custom fields",
						content: (
							<div>
								<ViewCustomFields applicantData={applicantData} />
							</div>
						),
					});
				return prev;
			});
		}

		setTabs((prev) => {
			const element = prev.find((item) => item.id === 7);
			if (!element)
				prev.push({
					id: 7,
					name: "Insights",
					content: (
						<div>
							<Insights caseId={applicantData?.id ?? "caseId n/a"} />
						</div>
					),
				});
			return prev;
		});

		if (!!processingHistory?.data?.length || !!eSignDocumentsData?.length) {
			setTabs((prev) => {
				const element = prev.find((item) => item.id === 9);
				if (!element)
					prev.push({
						id: 9,
						name: "Etc..",
						content: (
							<Etc
								businessId={applicantData?.business?.id ?? ""}
								caseId={applicantData?.id}
							/>
						),
					});
				return prev;
			});
		}
	}, [
		applicantData,
		loadingIncome,
		incomeData,
		businessVerificationDetails,
		processingHistory,
		eSignDocumentsData,
	]);

	return (
		<TabComponent
			tabs={tabs.sort((a, b) => a.id - b.id)}
			activeId={activeTabId}
			onTabChange={onTabChange ?? (() => {})}
		/>
	);
};

export default ViewTabLayout;
