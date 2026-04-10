import React from "react";
import {
	CheckCircleIcon,
	ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import CaseProgressOrScore from "@/components/CaseProgressOrScore/CaseProgressOrScore";
import useGetCaseDetails from "@/hooks/useGetCaseDetails";
import { useAppContextStore } from "@/store/useAppContextStore";
import { BusinessNamesCard } from "./components/BusinessNamesCard";
import { AddressesCard } from "./components";

import { VALUE_NOT_AVAILABLE } from "@/constants";
import { VerificationBadge } from "@/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";

interface MatchResult {
	title: string;
	description: string;
}

export interface ContactInformationTabProps {
	caseId: string;
}

// todo: add back once Mastercard Match is implemented

const MatchSection: React.FC<{ results?: MatchResult[] }> = ({
	results = [],
}) => (
	<Card>
		<div className="flex flex-col bg-white rounded-xl">
			<CardHeader className="flex flex-row items-center justify-between pb-6 space-y-0">
				<div className="flex items-center space-x-2">
					<CardTitle className="flex items-center">
						MATCH
						{results.length > 0 ? (
							<VerificationBadge
								variant="warning"
								className="ml-2"
							>
								<ExclamationTriangleIcon className="text-yellow-700" />
								Results Found
							</VerificationBadge>
						) : (
							<VerificationBadge
								variant="success"
								className="ml-2"
							>
								<CheckCircleIcon className="text-green-700" />
								No matches found
							</VerificationBadge>
						)}
					</CardTitle>
				</div>
			</CardHeader>
			{results.length > 0 ? (
				<CardContent>
					<dl className="border-t border-gray-100">
						{results.map((result, index) => (
							<div
								key={index}
								className="py-4 border-b border-gray-100 last:border-b-0"
							>
								<dt className="text-sm font-medium text-gray-900">
									{result.title}
								</dt>
								<dd className="mt-1 text-sm text-gray-500">
									{result.description}
								</dd>
							</div>
						))}
					</dl>
				</CardContent>
			) : (
				<CardContent>
					<p className="pt-3 text-sm text-gray-500">
						No MATCH records were found. This means the merchant has
						not been reported for fraud, excessive chargebacks, data
						security issues, or other significant concerns in the
						credit card networks.
					</p>
				</CardContent>
			)}
		</div>
	</Card>
);

export const ContactInformationTab: React.FC<ContactInformationTabProps> = ({
	caseId,
}) => {
	const { customerId } = useAppContextStore();
	const { caseData } = useGetCaseDetails({ caseId, customerId });
	const businessId = caseData?.data?.business.id ?? VALUE_NOT_AVAILABLE;

	return (
		<div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
			<div className="flex flex-col col-span-1 gap-4 lg:col-span-7">
				<AddressesCard businessId={businessId} />
				<BusinessNamesCard businessId={businessId} />
				{/* todo: add back once Mastercard Match is implemented */}
				{/* <MatchSection results={[]} /> */}
			</div>
			<div className="flex flex-col col-span-1 gap-4 lg:col-span-5">
				<CaseProgressOrScore caseId={caseId} caseData={caseData} />
			</div>
		</div>
	);
};
