import React, { useMemo, useState } from "react";
import currency from "currency.js";
import CaseProgressOrScore from "@/components/CaseProgressOrScore/CaseProgressOrScore";
import useGetCaseDetails from "@/hooks/useGetCaseDetails";
import { capitalize } from "@/lib/helper";
import { useGetBankingIntegration } from "@/services/queries/integration.query";
import { useAppContextStore } from "@/store/useAppContextStore";
import type { GetBankingIntegrationResponseData } from "@/types/banking";
import { AccountDetailsModal } from "./components/AccountDetailsModal";
import { BankAccountsList } from "./components/BankAccounts";
import {
	CreditCardsList,
	CreditCardsListSkeleton,
} from "./components/CreditCards";
import type { BankAccount, CreditCard } from "./types";

import { formatCurrency } from "@/helpers";

export const AccountsTab: React.FC<{
	caseId: string;
}> = ({ caseId }) => {
	const { customerId } = useAppContextStore();
	const { caseData } = useGetCaseDetails({ caseId, customerId });
	const businessId = caseData?.data?.business.id ?? "";

	const [selectedAccount, setSelectedAccount] = useState<
		BankAccount | CreditCard
	>();
	const [isAccountModalOpen, setAccountModalOpen] = useState(false);

	const { data: bankingData, isLoading: isLoadingBankingData } =
		useGetBankingIntegration({
			businessId,
			caseId,
		});

	const bankAccountData = useMemo(
		() => bankingData?.data?.filter((item) => item.type !== "credit") ?? [],
		[bankingData],
	);

	const creditCardData = useMemo(
		() => bankingData?.data?.filter((item) => item.type === "credit") ?? [],
		[bankingData],
	);

	const formattedBankAccounts: BankAccount[] = useMemo(() => {
		if (!bankAccountData) return [];

		const mappedBankAccounts: GetBankingIntegrationResponseData[] =
			Object.values(bankAccountData).map((item: any) => {
				if (item?.deposit_account && item?.depositAccountInfo) {
					const { numbers } = item.depositAccountInfo;
					const matchingNumber = numbers?.ach.find(
						(number: any) =>
							number?.account_id === item?.id ||
							number?.account_id === item?.ach_account_id,
					);

					if (matchingNumber) {
						item = {
							...item,
							routing: matchingNumber.routing,
							wire_routing: matchingNumber.wire_routing,
						};
					} else if (!item?.routing) {
						item = {
							...item,
							routing: item?.routing_number,
							wire_routing: item?.wire_routing_number,
						};
					}
				}
				return item;
			});

		const calculateThreeMonthAverageBalance = (
			balances: Array<{ balance: string | number }>,
		): string => {
			if (!balances?.length) return currency(0).format();

			const recentBalances = balances.slice(-3);

			const validBalances = recentBalances.map((item) =>
				currency(item.balance),
			);

			const sum = validBalances.reduce(
				(acc, balance) => acc.add(balance),
				currency(0),
			);

			return sum.divide(validBalances.length).format();
		};

		return mappedBankAccounts.map(
			(account): BankAccount => ({
				displayValues: {
					...(account.bank_name && {
						bankName: {
							label: "Bank Name",
							value: account.bank_name,
						},
					}),
					...(account.institution_name && {
						institutionName: {
							label: "Institution Name",
							value: account.institution_name,
						},
					}),
					...(account.official_name && {
						accountName: {
							label: "Account Name",
							value: account.official_name,
						},
					}),
					accountType: {
						label: "Account Type",
						value: account.subtype ?? account.type ?? "--",
					},
					...(account.account_holder_type && {
						ownershipType: {
							label: "Ownership Type",
							value: capitalize(account.account_holder_type),
						},
					}),
					accountNumber: {
						label: "Account Number",
						value: account.bank_account ?? "--",
						mask: true,
					},
					routingNumber: {
						label: "Routing Number",
						value: account.routing ?? "--",
						mask: true,
					},
					...(account.wire_routing && {
						wireRoutingNumber: {
							label: "Wire Routing Number",
							value: account.wire_routing,
							mask: true,
						},
					}),
					...(account.account_holder_name && {
						accountHolderName: {
							label: "Account Holder Name",
							value: account.account_holder_name,
						},
					}),
					currentBalance: {
						label: "Current Balance",
						value: formatCurrency(
							Number(
								account?.balance_available ??
									account?.balance_current ??
									0,
							),
						),
					},
					threeMonthAverageBalance: {
						label: "Average Balance (Past 3 Months)",
						value: calculateThreeMonthAverageBalance(
							account.balances ?? [],
						),
					},
				},
				created_at: account.created_at,
				verification_result: account.verification_result,
				deposit_account: account.deposit_account,
				is_selected: account.is_selected,
				match: account.match,
			}),
		);
	}, [bankAccountData]);

	const formattedCreditCards: CreditCard[] = useMemo(() => {
		if (!creditCardData) return [];

		return creditCardData.map((card: any) => ({
			createdAt: card.created_at,
			displayValues: {
				institutionName: {
					label: "Institution Name",
					value: card.institution_name ?? "--",
				},
				accountName: {
					label: "Account Name",
					value: card.bank_name ?? "--",
				},
				cardType: {
					label: "Card Type",
					value: card.official_name ?? card.subtype ?? "Credit Card",
				},
				lastFour: {
					label: "Last Four",
					value: card.mask ?? "--",
				},
				balance: {
					label: "Balance",
					value: formatCurrency(
						Number(
							card?.balance_available ??
								card?.balance_current ??
								0,
						),
					),
				},
				limit: {
					label: "Limit",
					value: formatCurrency(Number(card.balance_limit ?? 0)),
				},
			},
		}));
	}, [creditCardData]);

	// TODO: remove this once we are ready to show credit cards
	const showCreditCards = false;

	return (
		<>
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
				<div className="flex flex-col col-span-1 gap-4 lg:col-span-7">
					{/* TODO: hiding this graph for now */}
					{/* <Card className="flex flex-col pt-6 overflow-hidden">
						<CardContent className="flex-1">
							<CurrentBalanceGraph />
						</CardContent>
					</Card> */}
					<BankAccountsList
						loading={isLoadingBankingData}
						accounts={formattedBankAccounts}
						onSelect={(account) => {
							setSelectedAccount(account);
							setAccountModalOpen(true);
						}}
					/>
					{showCreditCards && isLoadingBankingData ? (
						<CreditCardsListSkeleton />
					) : (
						showCreditCards && (
							<CreditCardsList
								cards={formattedCreditCards}
								onSelect={(card) => {
									setSelectedAccount(card);
									setAccountModalOpen(true);
								}}
							/>
						)
					)}
				</div>
				<div className="flex flex-col col-span-1 gap-4 lg:col-span-5">
					<CaseProgressOrScore caseId={caseId} caseData={caseData} />
				</div>
			</div>
			<AccountDetailsModal
				account={selectedAccount}
				isOpen={isAccountModalOpen}
				onClose={() => {
					setAccountModalOpen(false);
				}}
			/>
		</>
	);
};
