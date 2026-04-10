import { createContext, useContext } from "react";
import { type UseQueryResult } from "@tanstack/react-query";
import { getItem } from "@/lib/localStorage";
import { useGetCustomerBetaSetttngs } from "@/services/queries/customer.query";
import { type GetCustomerBetaSettingsResponse } from "@/types/customer";

import { LOCALSTORAGE } from "@/constants/LocalStorage";

const BetaSettingsContext =
	createContext<UseQueryResult<GetCustomerBetaSettingsResponse> | null>(null);

export const BetaSettingsProvider = ({
	children,
}: {
	children: React.ReactNode;
}) => {
	const customerId: string = getItem(LOCALSTORAGE.customerId) ?? "";
	const query = useGetCustomerBetaSetttngs(customerId);

	return (
		<BetaSettingsContext.Provider value={query}>
			{children}
		</BetaSettingsContext.Provider>
	);
};
export const useBetaSettings = () => {
	const context = useContext(BetaSettingsContext);
	if (!context) {
		throw new Error(
			"useBetaSettings must be used within a BetaSettingsProvider",
		);
	}
	return context;
};
