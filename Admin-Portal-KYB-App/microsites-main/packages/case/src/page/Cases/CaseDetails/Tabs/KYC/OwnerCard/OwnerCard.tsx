import React, { useMemo } from "react";
import { InfoIcon } from "lucide-react";
import {
	useGetApplicantVerificationDetails,
	useGetFactsKyc,
} from "@/services/queries/integration.query";
import { useInlineEditStore } from "@/store/useInlineEditStore";
import { type Owner } from "@/types/case";
import { InternalFieldFooter } from "../../../components/InternalFieldFooter";
import {
	shouldHideEmailReport,
	shouldHideFraudReport,
	shouldInvalidateIdv,
} from "../config/OverviewTab/fieldRelationships";
import { EmailReport } from "./EmailReport";
import { FraudReport } from "./FraudReport";
import { OverviewReport } from "./OverviewReport";
import { OwnerCardTitleRiskBadges } from "./OwnerCardTitleRiskBadges";

import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Skeleton } from "@/ui/skeleton";

/**
 * Message displayed when report data is stale due to field edits.
 * Prompts user to re-run integrations to get updated verification results.
 */
const StaleReportMessage: React.FC<{ reportName: string }> = ({
	reportName,
}) => (
	<div className="flex items-start gap-3 p-4 rounded-md bg-amber-50 border border-amber-200 text-amber-800">
		<InfoIcon className="h-5 w-5 mt-0.5 flex-shrink-0" />
		<div>
			<p className="font-medium">{reportName} data may be outdated</p>
			<p className="text-sm mt-1 text-amber-700">
				Recent edits to owner information may have invalidated this
				report. Click &quot;Re-Run Integrations&quot; to verify with the
				updated data.
			</p>
		</div>
	</div>
);

export const OwnerCard: React.FC<{
	owner: Owner | null;
	businessId: string;
	customerId: string;
	caseId: string;
	/** Optional id for the Email Report card (e.g. "email-report" for scroll-from-case-results). Only set on one card per page. */
	emailReportCardId?: string;
	/** Optional id for the Fraud Report card (e.g. "fraud-report" for scroll-from-case-results). Only set on one card per page. */
	fraudReportCardId?: string;
}> = ({
	owner,
	businessId,
	customerId,
	caseId,
	emailReportCardId,
	fraudReportCardId,
}) => {
	const ownerId = owner?.id ?? "";

	// Get edited facts for this case to determine if reports should be hidden
	const { editedFacts } = useInlineEditStore(caseId);

	// Filter editedFacts to only this owner's edits (keys are prefixed with "ownerId:")
	const ownerEditedFacts = useMemo(() => {
		const prefix = `${ownerId}:`;
		return editedFacts
			.filter((f) => f.startsWith(prefix))
			.map((f) => f.slice(prefix.length));
	}, [editedFacts, ownerId]);

	// Fetch KYC facts from the new API (for owner data and overrides)
	const { data: kycFactsData, isLoading: isLoadingKycFacts } =
		useGetFactsKyc(businessId);

	// Legacy API for verification data (email/fraud reports)
	const { data: verificationData, isLoading: isLoadingVerificationData } =
		useGetApplicantVerificationDetails(businessId, ownerId);

	// Determine if reports/verifications should be invalidated based on edited fields
	const hideEmailReport = shouldHideEmailReport(ownerEditedFacts);
	const hideFraudReport = shouldHideFraudReport(ownerEditedFacts);
	const isIdvStale = shouldInvalidateIdv(ownerEditedFacts);

	// Get owner data from KYC facts API (includes any overrides)
	const kycOwner = useMemo(() => {
		const owners = kycFactsData?.data?.owners_submitted?.value;
		if (!owners || !ownerId) return null;
		return owners.find((o) => o.id === ownerId) ?? null;
	}, [kycFactsData, ownerId]);

	// Merge KYC facts owner data with original owner (facts API takes priority)
	const mergedOwner = useMemo(() => {
		if (!owner) return null;
		if (!kycOwner) return owner;
		return {
			...owner,
			first_name: kycOwner.first_name ?? owner.first_name,
			last_name: kycOwner.last_name ?? owner.last_name,
			date_of_birth: kycOwner.date_of_birth ?? owner.date_of_birth,
			ssn: kycOwner.ssn ?? owner.ssn,
			email: kycOwner.email ?? owner.email,
			mobile: kycOwner.mobile ?? owner.mobile,
			address_line_1: kycOwner.address_line_1 ?? owner.address_line_1,
			address_line_2: kycOwner.address_line_2 ?? owner.address_line_2,
			address_apartment:
				kycOwner.address_apartment ?? owner.address_apartment,
			address_city: kycOwner.address_city ?? owner.address_city,
			address_state: kycOwner.address_state ?? owner.address_state,
			address_postal_code:
				kycOwner.address_postal_code ?? owner.address_postal_code,
			address_country: kycOwner.address_country ?? owner.address_country,
			ownership_percentage:
				kycOwner.ownership_percentage ?? owner.ownership_percentage,
		};
	}, [owner, kycOwner]);

	// Guest owner edits from KYC facts API
	const guestOwnerEdits = useMemo(() => {
		return (
			kycFactsData?.data?.guest_owner_edits ??
			owner?.guest_owner_edits ??
			[]
		);
	}, [kycFactsData, owner]);

	const riskCheckResult =
		verificationData?.data?.applicant?.risk_check_result;

	const isLoading = isLoadingKycFacts || isLoadingVerificationData;

	const hasApplicantFields = guestOwnerEdits.length > 0;
	const hasInternalFields = !!kycFactsData?.data?.owners_submitted?.override;

	return (
		<div className="flex flex-col gap-4">
			<Card className="flex flex-col">
				<CardHeader className="flex flex-row items-center justify-between">
					<div className="flex items-center gap-2">
						<CardTitle>
							{mergedOwner?.owner_type === "CONTROL"
								? "Overview"
								: "Beneficial Owner"}
						</CardTitle>
						{isLoading ? (
							<div className="flex items-center gap-2">
								<Skeleton className="w-[85px] h-[26px]" />
								<Skeleton className="w-[70px] h-[26px]" />
							</div>
						) : (
							<OwnerCardTitleRiskBadges
								verificationData={verificationData?.data}
								isControl={
									mergedOwner?.owner_type === "CONTROL"
								}
								isVerificationStale={isIdvStale}
							/>
						)}
					</div>
				</CardHeader>
				<CardContent>
					<OverviewReport
						owner={mergedOwner}
						customerId={customerId}
						businessId={businessId}
						riskCheckResult={riskCheckResult}
						isLoadingRiskCheckResult={isLoading}
						caseId={caseId}
						verificationData={verificationData}
					/>
				</CardContent>
			</Card>

			<Card id={emailReportCardId} className="flex flex-col scroll-mt-4">
				<CardHeader>
					<CardTitle>Email Report</CardTitle>
				</CardHeader>
				<CardContent>
					{hideEmailReport ? (
						<StaleReportMessage reportName="Email Report" />
					) : (
						<EmailReport
							owner={mergedOwner}
							businessId={businessId}
							riskCheckResult={riskCheckResult}
						/>
					)}
				</CardContent>
			</Card>

			<Card id={fraudReportCardId} className="flex flex-col scroll-mt-4">
				<CardHeader>
					<CardTitle>Fraud Report</CardTitle>
				</CardHeader>
				<CardContent>
					{hideFraudReport ? (
						<StaleReportMessage reportName="Fraud Report" />
					) : (
						<FraudReport
							owner={mergedOwner}
							businessId={businessId}
							riskCheckResult={riskCheckResult}
							isLoadingRiskCheckResult={isLoading}
						/>
					)}
				</CardContent>
			</Card>
			<InternalFieldFooter
				hasApplicantFields={hasApplicantFields}
				hasInternalFields={hasInternalFields}
			/>
		</div>
	);
};
