import React from "react";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import { useGetCustomerIntegrationSettings } from "@/services/queries/integration.query";
import { useAppContextStore } from "@/store/useAppContextStore";
import { type GetBankingIntegrationResponseData } from "@/types/banking";
import { AccountAuthenticationResponseBadge } from "./AccountAuthenticationResponseBadge";
import { AccountContactVerificationResponseBadge } from "./AccountContactVerificationResponseBadge";
import { AccountMatchBadge } from "./AccountMatchBadge";
import { AccountVerificationResponseBadge } from "./AccountVerificationResponseBadge";

import { Skeleton } from "@/ui/skeleton";

type AccountBadgesProps =
	| {
			loading?: never;
			account: Pick<
				GetBankingIntegrationResponseData,
				| "verification_result"
				| "match"
				| "is_selected"
				| "deposit_account"
			>;
	  }
	| {
			loading: true;
			account?: never;
	  };

export const AccountBadges: React.FC<AccountBadgesProps> = ({
	account,
	loading,
}) => {
	const { customerId } = useAppContextStore();
	const { data: customerIntegrationSettings } =
		useGetCustomerIntegrationSettings(customerId ?? "");
	const isGVerifyActive =
		customerIntegrationSettings?.data?.settings?.gverify?.status ===
		"ACTIVE";
	const isGAuthenticateActive =
		customerIntegrationSettings?.data?.settings?.gauthenticate?.status ===
		"ACTIVE";

	const verificationResponse =
		account?.verification_result?.account_verification_response;
	const authenticationResponse =
		account?.verification_result?.account_authentication_response;

	return (
		<>
			{!loading && account.is_selected && account.deposit_account && (
				<div className="flex flex-wrap items-center gap-1 text-xs font-medium text-green-700">
					<CheckCircleIcon className="stroke-2 size-4" />
					<span>Deposit Account</span>
				</div>
			)}
			<div className="flex flex-wrap gap-8">
				<div className="flex flex-col gap-2">
					{loading ? (
						<Skeleton className="w-24 h-4" />
					) : (
						<label className="text-xs text-gray-600">
							Account Status
						</label>
					)}
					{loading ? (
						<Skeleton className="w-24 h-[30px]" />
					) : isGVerifyActive ? (
						<AccountVerificationResponseBadge
							response={verificationResponse}
						/>
					) : (
						<AccountMatchBadge match={account?.match} />
					)}
				</div>
				{!loading && isGAuthenticateActive && (
					<>
						<div className="flex flex-col gap-2">
							<label className="text-xs text-gray-600">
								Account Name
							</label>
							<AccountAuthenticationResponseBadge
								response={authenticationResponse}
							/>
						</div>
						<div className="flex flex-col gap-2">
							<label className="text-xs text-gray-600">
								Contact Verification
							</label>
							<AccountContactVerificationResponseBadge
								response={authenticationResponse}
							/>
						</div>
					</>
				)}
			</div>
		</>
	);
};
