import React from "react";
import { useFlags } from "launchdarkly-react-client-sdk";
import {
	useGetFactsBusinessDetails,
	useGetFactsKyb,
	useGetGoogleProfileByBusinessId,
} from "@/services/queries/integration.query";
import { CardList } from "../../../components";
import { AddressCardListItem } from "./AddressCardListItem";
import { ContactInformationCardListItem } from "./ContactInformationCardListItem";

import FEATURE_FLAGS from "@/constants/FeatureFlags";
import { enrichAddressesWithStatusFor360ReportParity } from "@/helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Skeleton } from "@/ui/skeleton";

export const AddressesCard: React.FC<{
	businessId: string;
}> = ({ businessId }) => {
	const flags = useFlags();
	const isProxyFlag = flags[FEATURE_FLAGS.BEST_65_PROXY_FACT];
	const {
		data: factsBusinessDetails,
		isLoading: isLoadingFactsBusinessDetails,
	} = useGetFactsBusinessDetails(businessId, isProxyFlag);

	const submittedBusinessAddresses =
		factsBusinessDetails?.data?.business_addresses_submitted_strings
			?.value ?? [];

	const { data: factsKyb, isLoading: isLoadingFactsKyb } = useGetFactsKyb(
		businessId,
		isProxyFlag,
	);

	const { data: googleProfileData, isLoading: isProfileLoading } =
		useGetGoogleProfileByBusinessId(businessId);

	// The google profile address_match status is calculated using the primary submitted address.
	// The google profile business_match status is calculated using the submitted business name.
	// If business_match is "Match Found" and address_match is "Match", we assume the primary submitted address is verified
	const googleProfileMatch =
		googleProfileData?.data?.business_match?.toLowerCase() ===
			"match found" &&
		googleProfileData?.data?.address_match?.toLowerCase() === "match";

	const kybAddresses = (factsKyb?.data?.addresses?.value ?? []).map(
		(address) => ({
			address,
			is_primary: false,
		}),
	);

	const kybDeliverableAddresses =
		factsKyb?.data?.addresses_deliverable?.value ?? [];
	const kybAddressVerification = factsKyb?.data?.address_verification?.value;

	const submittedAddresses = enrichAddressesWithStatusFor360ReportParity(
		submittedBusinessAddresses,
		kybDeliverableAddresses,
		kybAddressVerification,
		googleProfileMatch,
	);

	const reportedAddresses = enrichAddressesWithStatusFor360ReportParity(
		kybAddresses,
		kybDeliverableAddresses,
		kybAddressVerification,
		googleProfileMatch,
	);

	const isLoading =
		isLoadingFactsBusinessDetails || isLoadingFactsKyb || isProfileLoading;

	return (
		<Card className="flex flex-col">
			<CardHeader className="flex flex-row items-center justify-between pb-6 space-y-0">
				<div className="flex items-center space-x-2">
					<CardTitle>Addresses</CardTitle>
				</div>
			</CardHeader>
			<CardContent>
				{isLoading ? (
					<CardList>
						<ContactInformationCardListItem
							label={<Skeleton className="w-1/5 h-5" />}
							value={<Skeleton className="w-2/5 h-5" />}
							registrationVerificationBadge={
								<Skeleton className="w-[84px] h-[28px]" />
							}
							googleProfileVerificationBadge={
								<Skeleton className="w-[84px] h-[28px]" />
							}
						/>
					</CardList>
				) : (
					<CardList>
						{submittedAddresses.map((address, index) => (
							<AddressCardListItem
								key={index}
								label="Submitted Address"
								address={address}
							/>
						))}
						{reportedAddresses.map((address, index) => (
							<AddressCardListItem
								key={index}
								label="Reported Address"
								address={address}
							/>
						))}
					</CardList>
				)}
			</CardContent>
		</Card>
	);
};
