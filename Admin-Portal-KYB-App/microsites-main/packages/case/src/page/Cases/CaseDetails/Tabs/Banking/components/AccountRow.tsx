import { BuildingLibraryIcon } from "@heroicons/react/24/outline";
import type { BankAccount } from "../types";
import { AccountBadges } from "./AccountBadges";

import { maskValue } from "@/helpers";
import { Skeleton } from "@/ui/skeleton";

type AccountRowProps =
	| {
			loading?: never;
			account: BankAccount;
			onSelect: (account: BankAccount) => void;
	  }
	| {
			loading: true;
			account?: never;
			onSelect?: never;
	  };

export const AccountRow: React.FC<AccountRowProps> = ({
	account,
	loading,
	onSelect,
}) => {
	return (
		<div className="flex items-start justify-between py-4 border-t border-gray-100">
			<div className="flex flex-col gap-4 pl-14">
				<div className="flex items-center gap-4">
					{loading ? (
						<Skeleton className="size-10 rounded-full absolute left-10" />
					) : (
						<div className="flex items-center justify-center size-10 rounded-full bg-gray-100 absolute left-10 overflow-hidden">
							<BuildingLibraryIcon className="size-6" />
						</div>
					)}

					<div className="flex flex-col gap-1">
						{loading ? (
							<Skeleton className="w-24 h-6" />
						) : (
							<div
								className="font-medium text-blue-600 cursor-pointer hover:underline"
								onClick={() => {
									onSelect(account);
								}}
							>
								{account.displayValues.accountName?.value ??
									account.displayValues.accountType
										.value}{" "}
								(
								{maskValue(
									account.displayValues.accountNumber.value,
								)}
								)
							</div>
						)}
						<div className="text-sm text-blue-600">
							{loading ? (
								<Skeleton className="w-40 h-6" />
							) : (
								`${account.displayValues.bankName?.value ?? ""}`
							)}
						</div>
					</div>
				</div>
				{loading ? (
					<AccountBadges loading />
				) : (
					<AccountBadges account={account} />
				)}
			</div>
			<div className="text-right font-normal text-gray-800">
				{loading ? (
					<Skeleton className="w-20 h-6" />
				) : (
					account.displayValues.currentBalance.value
				)}
			</div>
		</div>
	);
};
