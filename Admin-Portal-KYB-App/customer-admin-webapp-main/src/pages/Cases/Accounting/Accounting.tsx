import TabsWithButton from "@/components/Tabs/TabsWithButton";
import { BalanceSheetTab } from "./BalanceSheetTab";
import { IncomeStatementTab } from "./IncomeStatementTab";
import UploadedStatements from "./UploadedStatements";
import "./accountTable.css";

type AccountingProps = {
	businessId: string;
	caseId?: string;
};

const Accounting: React.FC<AccountingProps> = ({ businessId, caseId }) => {
	const tabs = [
		{
			key: "financials-incomestatment",
			id: 0,
			name: "Income Statement",
			content: <IncomeStatementTab businessId={businessId} caseId={caseId} />,
		},
		{
			key: "financials-balancesheet",
			id: 1,
			name: "Balance Sheet",
			content: <BalanceSheetTab businessId={businessId} caseId={caseId} />,
		},
		{
			key: "financials-balancesheet",
			id: 2,
			name: "Uploads",
			content: <UploadedStatements businessId={businessId} caseId={caseId} />,
		},
	];

	return (
		<>
			<TabsWithButton
				tabs={tabs}
				activeId={0}
				onTabChange={(id: number): void => {}}
			></TabsWithButton>
		</>
	);
};

export default Accounting;
