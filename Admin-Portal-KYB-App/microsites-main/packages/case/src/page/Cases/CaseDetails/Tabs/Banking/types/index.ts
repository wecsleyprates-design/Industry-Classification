import { type GetBankingIntegrationResponseData } from "@/types/banking";

export interface AccountDisplayValue {
	label: string;
	value: string;
	mask?: boolean;
}

export type BadgeType =
	| "blue_check"
	| "green_check"
	| "warning"
	| "red_exclamation"
	| "red_x"
	| "deposit";

export interface AccountBadge {
	label: string;
	tooltip?: string;
	type: BadgeType;
}

export interface BankAccount extends Pick<
	GetBankingIntegrationResponseData,
	| "verification_result"
	| "deposit_account"
	| "is_selected"
	| "match"
	| "created_at"
> {
	displayValues: Record<string, AccountDisplayValue>;
}

export interface CreditCard {
	createdAt: Date;
	displayValues: Record<string, AccountDisplayValue>;
	badges?: AccountBadge[];
}

export interface AccountTransaction {
	date: string;
	description: string;
	amount: number;
	accountType: string;
	currency: string;
}

export type TimePeriod =
	| "All Time"
	| "7 Days"
	| "1 Month"
	| "3 Months"
	| "1 Year";
