import React from "react";
import {
	CheckBadgeIcon,
	ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { useFlags } from "launchdarkly-react-client-sdk";
import { usePermission } from "@/hooks/usePermission";
import { useGetFactsKyb } from "@/services/queries/integration.query";
import { CardList } from "../../../components";
import { ContactInformationCardListItem } from "./ContactInformationCardListItem";

import FEATURE_FLAGS from "@/constants/FeatureFlags";
import { VerificationBadge } from "@/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Skeleton } from "@/ui/skeleton";
import { Tooltip } from "@/ui/tooltip";

const BusinessNamesCardBadge: React.FC<{
	nameMatch: boolean;
	namesCount: number;
	loading: boolean;
}> = ({ nameMatch, namesCount, loading }) => {
	if (loading) {
		return <Skeleton className="w-[76px] h-[26px] ml-auto" />;
	}

	const badge = nameMatch ? (
		<VerificationBadge variant="info">
			<CheckBadgeIcon className="size-5" />
			<span>Verified</span>
		</VerificationBadge>
	) : (
		<VerificationBadge variant="warning">
			<ExclamationTriangleIcon />
			Unverified
		</VerificationBadge>
	);

	return namesCount > 1 ? (
		<Tooltip
			trigger={badge}
			triggerContainerClassName="flex"
			content={
				nameMatch
					? "One or more of the below business names have been verified."
					: "Multiple business names found, but none have been verified."
			}
		/>
	) : (
		badge
	);
};

export const BusinessNamesCard: React.FC<{
	businessId: string;
}> = ({ businessId }) => {
	const flags = useFlags();
	const isProxyFlag = flags[FEATURE_FLAGS.BEST_65_PROXY_FACT];
	const { data: factsKyb, isLoading: isLoadingFactsKyb } = useGetFactsKyb(
		businessId,
		isProxyFlag,
	);

	const kybSubmittedNames =
		factsKyb?.data?.names_submitted?.value?.filter((n) => n.submitted) ??
		[];
	const kybFoundNames: string[] = factsKyb?.data?.names_found?.value ?? [];

	const namesCount = kybSubmittedNames.length + kybFoundNames.length;
	const nameMatch = factsKyb?.data?.name_match_boolean?.value ?? false;

	return (
		<Card className="flex flex-col">
			<CardHeader className="flex flex-row items-center justify-between pb-6 space-y-0">
				<div className="flex flex-row items-center justify-center space-x-2">
					<CardTitle>Business Names</CardTitle>
					<BusinessNamesCardBadge
						nameMatch={nameMatch}
						namesCount={namesCount}
						loading={isLoadingFactsKyb}
					/>
				</div>
			</CardHeader>
			<CardContent>
				{isLoadingFactsKyb ? (
					<CardList>
						<ContactInformationCardListItem
							label={<Skeleton className="w-1/5 h-5" />}
							value={<Skeleton className="w-2/5 h-5" />}
						/>
					</CardList>
				) : (
					<CardList>
						{kybSubmittedNames.map((name, index) => (
							<ContactInformationCardListItem
								type="businessName"
								key={index}
								label="Submitted Name"
								value={name.name}
							/>
						))}
						{kybFoundNames.map((name, index) => (
							<ContactInformationCardListItem
								type="businessName"
								key={index}
								label="Reported Name"
								value={name}
							/>
						))}
					</CardList>
				)}
			</CardContent>
		</Card>
	);
};
