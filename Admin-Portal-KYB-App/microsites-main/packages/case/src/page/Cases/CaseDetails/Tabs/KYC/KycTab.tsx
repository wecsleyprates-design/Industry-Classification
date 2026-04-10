import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { UserGroupIcon } from "@heroicons/react/24/outline";
import CaseProgressOrScore from "@/components/CaseProgressOrScore/CaseProgressOrScore";
import useGetCaseDetails from "@/hooks/useGetCaseDetails";
import { cn } from "@/lib/utils";
import { useGetFactsKyc } from "@/services/queries/integration.query";
import { useAppContextStore } from "@/store/useAppContextStore";
import { OwnerCard } from "./OwnerCard";

import { Card } from "@/ui/card";
import {
	SubTabs,
	SubTabsContent,
	SubTabsList,
	SubTabsTrigger,
} from "@/ui/tabs";

export interface KycTabProps {
	caseId: string;
}

const EMAIL_REPORT_SECTION_ID = "email-report";
const FRAUD_REPORT_SECTION_ID = "fraud-report";

export const KycTab: React.FC<KycTabProps> = ({ caseId }) => {
	const { hash } = useLocation();
	const { customerId } = useAppContextStore();
	const { caseData } = useGetCaseDetails({ caseId, customerId });
	const businessId = caseData?.data?.business.id ?? "";
	const owners = caseData?.data?.owners ?? [];

	// When navigating from case results with #email-report or #fraud-report, scroll to the card
	useEffect(() => {
		const sectionId =
			hash === `#${EMAIL_REPORT_SECTION_ID}`
				? EMAIL_REPORT_SECTION_ID
				: hash === `#${FRAUD_REPORT_SECTION_ID}`
					? FRAUD_REPORT_SECTION_ID
					: null;
		if (!sectionId) return;
		const timer = setTimeout(() => {
			document.getElementById(sectionId)?.scrollIntoView({
				behavior: "smooth",
				block: "start",
			});
		}, 100);
		return () => clearTimeout(timer);
	}, [hash]);

	// Fetch KYC facts to get override data for owner names
	const { data: kycFactsData } = useGetFactsKyc(businessId);
	const kycOwners = kycFactsData?.data?.owners_submitted?.value;

	// Merge override names with original owner data for tab display
	const sortedOwners = useMemo(() => {
		const merged = [...owners].map((owner) => {
			// Find matching owner in KYC facts (includes overrides)
			const kycOwner = kycOwners?.find((ko) => ko.id === owner.id);
			if (kycOwner) {
				return {
					...owner,
					first_name: kycOwner.first_name ?? owner.first_name,
					last_name: kycOwner.last_name ?? owner.last_name,
				};
			}
			return owner;
		});

		return merged.sort((a, b) => {
			if (a.owner_type === "CONTROL" && b.owner_type !== "CONTROL")
				return -1;
			if (a.owner_type !== "CONTROL" && b.owner_type === "CONTROL")
				return 1;
			return 0;
		});
	}, [owners, kycOwners]);

	const [selectedOwnerTab, setSelectedOwnerTab] = useState<string>("0");

	const worthScoreSection = (
		<div className="flex flex-col col-span-1 gap-4 lg:col-span-5">
			<div className={cn(owners.length > 0 ? "mt-4" : "")}>
				<CaseProgressOrScore caseId={caseId} caseData={caseData} />
			</div>
		</div>
	);

	const EmptyState: React.FC = () => (
		<Card>
			<div className="flex flex-col items-center justify-center py-12 text-center">
				<div className="p-4 mb-4 border border-gray-200 rounded-lg">
					<UserGroupIcon className="w-10 h-10 text-blue-600" />
				</div>
				<h3 className="mb-1 text-lg font-medium text-gray-900">
					No Ownership Details Available
				</h3>
				<p className="max-w-sm text-sm text-gray-500">
					This section will continue to update as data becomes
					available.
				</p>
			</div>
		</Card>
	);

	return sortedOwners.length > 0 ? (
		<SubTabs
			value={selectedOwnerTab}
			onValueChange={setSelectedOwnerTab}
			className="overflow-hidden"
		>
			<SubTabsList>
				{sortedOwners.map((owner, index) => (
					<SubTabsTrigger key={owner.id} value={index.toString()}>
						{owner.first_name} {owner.last_name}
					</SubTabsTrigger>
				))}
			</SubTabsList>

			<div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
				<div className="flex flex-col col-span-1 gap-4 lg:col-span-7">
					{sortedOwners.map((owner, index) => (
						<SubTabsContent key={owner.id} value={index.toString()}>
							<OwnerCard
								owner={owner}
								caseId={caseData?.data.id ?? ""}
								businessId={businessId}
								customerId={customerId}
								emailReportCardId={
									index === 0
										? EMAIL_REPORT_SECTION_ID
										: undefined
								}
								fraudReportCardId={
									index === 0
										? FRAUD_REPORT_SECTION_ID
										: undefined
								}
							/>
						</SubTabsContent>
					))}
				</div>
				{worthScoreSection}
			</div>
		</SubTabs>
	) : (
		<div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
			<div className="flex flex-col col-span-1 gap-4 lg:col-span-7">
				<EmptyState />
			</div>
			{worthScoreSection}
		</div>
	);
};
