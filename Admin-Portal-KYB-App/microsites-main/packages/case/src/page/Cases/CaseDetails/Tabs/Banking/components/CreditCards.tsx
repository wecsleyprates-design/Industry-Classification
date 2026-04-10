import { CreditCardIcon } from "@heroicons/react/24/outline";
import { NullState } from "../../../components";
import type { CreditCard } from "../types";

import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Skeleton } from "@/ui/skeleton";

export const CreditCardsListSkeleton: React.FC = () => {
	return (
		<Card className="flex flex-col overflow-hidden">
			<CardHeader className="flex flex-row items-center justify-between px-6 pt-4 pb-4 space-y-0">
				<CardTitle className="text-lg font-semibold text-gray-900">
					Credit Cards
				</CardTitle>
			</CardHeader>
			<CardContent className="px-6">
				<div className="space-y-4">
					{[...Array(2)].map((_, index) => (
						<div
							key={index}
							className="flex items-center justify-between p-4 border-t border-gray-100 rounded-lg"
						>
							<div className="flex items-center gap-4">
								<Skeleton className="w-8 h-8 rounded-full" />
								<div className="space-y-1.5">
									<Skeleton className="w-32 h-5" />
									<Skeleton className="w-40 h-4" />
									<div className="flex gap-2">
										<Skeleton className="w-20 h-5 rounded-full" />
										<Skeleton className="w-24 h-5 rounded-full" />
									</div>
								</div>
							</div>
							<div className="space-y-1 text-right">
								<Skeleton className="w-24 h-6" />
								<Skeleton className="w-20 h-4" />
							</div>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
};

export const CreditCardsList: React.FC<{
	cards: CreditCard[];
	onSelect: (card: CreditCard) => void;
}> = ({ cards, onSelect }) => {
	const sortedCards = cards.sort(
		(a, b) =>
			new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
	);

	return (
		<Card className="flex flex-col overflow-hidden">
			<CardHeader className="flex flex-row items-center justify-between px-6 pt-4 pb-4 space-y-0">
				<CardTitle className="text-lg font-semibold text-gray-900">
					Credit Cards
				</CardTitle>
			</CardHeader>
			<CardContent className="px-6">
				{sortedCards.length > 0 ? (
					<div className="space-y-4">
						{sortedCards.map((card, index) => (
							<div
								key={index}
								className="flex items-center justify-between p-4 border-t border-gray-100 rounded-lg"
							>
								<div className="flex items-center gap-4">
									<div className="flex items-center justify-center w-8 h-8 border border-gray-100 rounded-full bg-gray-50">
										<div className="text-gray-600 size-5">
											<svg
												xmlns="http://www.w3.org/2000/svg"
												fill="none"
												viewBox="0 0 24 24"
												strokeWidth={1.5}
												stroke="currentColor"
												className="size-5"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"
												/>
											</svg>
										</div>
									</div>
									<div className="space-y-1.5">
										<div
											className="font-medium text-blue-600 cursor-pointer hover:underline"
											onClick={() => {
												onSelect(card);
											}}
										>
											{
												card.displayValues.accountName
													.value
											}
										</div>
										<div className="text-sm text-gray-600">
											{card.displayValues.cardType.value}{" "}
											(•••
											{card.displayValues.lastFour.value})
										</div>
										<div className="flex flex-wrap gap-2">
											{/** TODO: add badges */}
										</div>
									</div>
								</div>
								<div className="space-y-1 text-right">
									<div className="font-medium text-gray-900">
										{card.displayValues.balance.value}
									</div>
									<div className="text-sm text-gray-500">
										Limit: {card.displayValues.limit.value}
									</div>
								</div>
							</div>
						))}
					</div>
				) : (
					<NullState
						icon={
							<CreditCardIcon className="size-12 text-blue-600" />
						}
						title="No Connected Credit Cards"
						description="Credit cards display here as they are added by the applicant, yourself, or someone from your team."
					/>
				)}
			</CardContent>
		</Card>
	);
};
