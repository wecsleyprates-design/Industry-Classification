import { BuildingLibraryIcon } from "@heroicons/react/24/outline";
import { NullState } from "../../../components";
import type { BankAccount } from "../types";
import { AccountRow } from "./AccountRow";

import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";

export const BankAccountsList: React.FC<{
	accounts: BankAccount[];
	loading: boolean;
	onSelect: (account: BankAccount) => void;
}> = ({ accounts, loading, onSelect }) => {
	const sortedAccounts = accounts.sort(
		(a, b) =>
			new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
	);
	return (
		<Card className="flex flex-col overflow-hidden">
			<CardHeader className="flex flex-row items-center justify-between px-6 pt-4 pb-4 space-y-0">
				<CardTitle className="text-lg font-semibold text-gray-900">
					Bank Accounts
				</CardTitle>
			</CardHeader>
			<CardContent className="px-6">
				{loading || sortedAccounts.length > 0 ? (
					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<h3 className="text-sm font-medium text-gray-500">
								OPEN ACCOUNTS
							</h3>
							<h3 className="text-sm font-medium text-gray-500">
								BALANCE
							</h3>
						</div>

						<div className="space-y-4">
							{loading
								? [...Array(3)].map((_, index) => (
										<AccountRow key={index} loading />
									))
								: sortedAccounts.map((account, index) => (
										<AccountRow
											key={index}
											account={account}
											onSelect={onSelect}
										/>
									))}
						</div>
					</div>
				) : (
					<NullState
						icon={
							<BuildingLibraryIcon className="size-12 text-blue-600" />
						}
						title="No Connected Bank Accounts"
						description="Bank accounts display here as they are added by the applicant, yourself, or someone from your team."
					/>
				)}
			</CardContent>
		</Card>
	);
};
