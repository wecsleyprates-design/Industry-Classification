import { useMemo } from "react";
import TableLoader from "@/components/Spinner/TableLoader";
import TabsWithButton from "@/components/Tabs/TabsWithButton";
import {
	useGetBankingIntegration,
	useGetBankingUploads,
	useGetBusinessTradeLines,
} from "@/services/queries/integration.query";
import BankDetails from "./BankDetails";
import CreditDetails from "./CreditDetails";
import TradeLines from "./TradeLines";
import TransactionHistory from "./TransactionHistory";
import UploadedStatements from "./UploadedStatements";

type Props = {
	businessId: string;
	caseId?: string;
	scoreTriggerId?: string;
};

const BankVerification: React.FC<Props> = ({
	caseId,
	businessId,
	scoreTriggerId,
}) => {
	const { data: bankingData, isLoading: loading } = useGetBankingIntegration({
		businessId,
		caseId,
		scoreTriggerId,
	});

	const { data: uploadData, isLoading: loadingUpload } = useGetBankingUploads({
		businessId,
		caseId,
	});

	const bankAccountData = useMemo(
		() => bankingData?.data.filter((item) => item.type !== "credit"),
		[bankingData],
	);
	const creditCardData = useMemo(
		() => bankingData?.data.filter((item) => item.type === "credit"),
		[bankingData],
	);

	const uploadedStatementsData = useMemo(() => uploadData?.data, [uploadData]);

	const { data: tradeLinesData, isLoading: tradeLinesLoading } =
		useGetBusinessTradeLines({
			businessId,
			caseId,
			scoreTriggerId,
		});

	const tabs = [
		{
			key: "open-accounts",
			id: 0,
			name: "Open Accounts",
			content: (
				<>
					<BankDetails bankData={bankAccountData} loading={loading} />
					<CreditDetails bankData={creditCardData} loading={loading} />
					<TradeLines
						tradeLinesData={tradeLinesData}
						tradeLinesLoading={tradeLinesLoading}
					/>
				</>
			),
		},
		{
			key: "bank-statements",
			id: 1,
			name: "Statements",
			content: (
				<>
					<UploadedStatements
						uploadedStatements={uploadedStatementsData ?? []}
						loading={loadingUpload}
					/>
				</>
			),
		},
		{
			key: "transactions",
			id: 2,
			name: "Transactions",
			content: <TransactionHistory businessId={businessId} caseId={caseId} />,
		},
	];

	return (
		<>
			{loading && tradeLinesLoading ? (
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

export default BankVerification;
