import { useMemo } from "react";
import TableLoader from "@/components/Spinner/TableLoader";
import TabsWithButton from "@/components/Tabs/TabsWithButton";
import { getItem } from "@/lib/localStorage";
import { useGetVerdata } from "@/services/queries/integration.query";
import { useGetCustomerIntegrationSettingsByCustomerId } from "@/services/queries/riskAlert.query";
import AdverseMediaTab from "./AdverseMediaTab";
import BrandManagementTab from "./BrandManagementTab";
import PublicFillingsTab from "./PublicFillingsTab";

import { LOCALSTORAGE } from "@/constants/LocalStorage";

type Props = {
	businessId: string;
	caseId?: string;
	scoreTriggerId?: string;
	bussinessHistoryPage?: boolean;
};

const PublicRecordsIndex: React.FC<Props> = ({
	caseId,
	businessId,
	scoreTriggerId,
	bussinessHistoryPage = false,
}) => {
	const customerId: string = getItem(LOCALSTORAGE.customerId) ?? "";
	const { data, isLoading: verdataLoading } = useGetVerdata({
		businessId,
		caseId,
		scoreTriggerId,
	});
	const publicRecords = useMemo(() => data?.data, [data]);

	const {
		data: customerIntegrationSettingsData,
		isLoading: customerIntegrationSettingsLoading,
	} = useGetCustomerIntegrationSettingsByCustomerId(customerId ?? "", false);

	const tabs = [
		{
			key: "Brand_Management",
			id: 0,
			name: "Brand Management",
			content: <BrandManagementTab publicRecords={publicRecords} />,
		},
		{
			key: "Public_Filings",
			id: 1,
			name: "Public Filings",
			content: <PublicFillingsTab publicRecords={publicRecords} />,
		},
		...(customerIntegrationSettingsData?.data?.settings?.isAdverseMediaEnabled
			? [
					{
						key: "Adverse_Media",
						id: 2,
						name: "Adverse Media",
						content: (
							<AdverseMediaTab
								caseId={caseId ?? ""}
								businessId={bussinessHistoryPage ? businessId : null}
							/>
						),
					},
				]
			: []),
	];

	return (
		<>
			{verdataLoading || customerIntegrationSettingsLoading ? (
				<div className="flex justify-center py-2 tracking-tight">
					<TableLoader />
				</div>
			) : (
				<>
					<TabsWithButton
						tabs={tabs}
						activeId={0}
						onTabChange={(id: number): void => {}}
					></TabsWithButton>
				</>
			)}
		</>
	);
};

export default PublicRecordsIndex;
