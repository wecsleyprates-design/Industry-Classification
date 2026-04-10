import { useEffect, useState } from "react";
import { useFlags } from "launchdarkly-react-client-sdk";
// import TableLoader from "@/components/Spinner/TableLoader";
import { convertToLocalDate, getCurrentTimezone } from "@/lib/helper";
import { getItem } from "@/lib/localStorage";
import { useGetCaseByIdQuery } from "@/services/queries/case.query";
import {
	useGetBusinessNpi,
	useGetBusinessWebsite,
	useGetEquifax,
	useGetFactsBusinessDetails,
	useGetFactsKyb,
} from "@/services/queries/integration.query";
import { useGetCustomerOnboardingStages } from "@/services/queries/onboarding.query";
import { type BusinessEntityVerificationResponse } from "@/types/businessEntityVerification";
import type { FactBusinessDetailsResponseType } from "@/types/integrations";
import { type Stage } from "@/types/onboarding";
import { type PublicRecordsResponse } from "@/types/publicRecords";
import Business from "./Business";
import Industry from "./Industry";
import NPI from "./Npi";
import Owners from "./Owners";
import WebsiteReview from "./WebsiteReview";

import FEATURE_FLAGES from "@/constants/FeatureFlags";
import { LOCALSTORAGE } from "@/constants/LocalStorage";

interface ICompanyProfileProps {
	caseId: string;
	businessId: string;
	businessVerificationDetails?: BusinessEntityVerificationResponse;
	publicRecords?: PublicRecordsResponse;
}

const CompanyProfile: React.FC<ICompanyProfileProps> = ({
	businessId,
	caseId,
	businessVerificationDetails,
	publicRecords,
}) => {
	const customerId = getItem(LOCALSTORAGE.customerId) as string;
	const [businessAge, setBusinessAge] = useState<number | null>(null);

	function isNpiInStatusValid(stages?: Stage[]): boolean {
		// Find the "Company" stage
		const companyStage = stages?.find((stage) => stage.stage === "Company");

		if (!companyStage?.config) {
			return false; // "Company" stage not found or has no config
		}

		// Find the NPI field
		const npiField = companyStage.config.fields.find(
			(field) => field.name === "Primary Provider’s NPI Number*",
		);

		if (!npiField) {
			return false; // NPI field not found
		}

		// Check if status is "Optional" or "Required"
		return npiField.status === "Optional" || npiField.status === "Required";
	}

	const { data: applicantData } = useGetCaseByIdQuery({
		customerId,
		caseId: caseId ?? "",
		params: { filter: { time_zone: getCurrentTimezone() } },
	});

	const { data: businessWebsiteData, isLoading: businessWebsiteDataLoading } =
		useGetBusinessWebsite({
			businessId,
			caseId,
		});

	const { data: businessNpiData } = useGetBusinessNpi({
		businessId,
	});

	const { data: onboardingStagesData } = useGetCustomerOnboardingStages(
		customerId ?? "",
		{
			setupType: "modify_pages_fields_setup",
		},
	);

	const isNpiEnabled = isNpiInStatusValid(onboardingStagesData?.data);

	const featureFlags = useFlags();
	const factsEnabled = featureFlags[FEATURE_FLAGES.PAT_80_FACTS] as boolean;
	const factsBusinessDetailsQuery = useGetFactsBusinessDetails(businessId);
	const businessDetailFacts: FactBusinessDetailsResponseType | undefined =
		factsEnabled ? factsBusinessDetailsQuery?.data?.data : undefined;

	useEffect(() => {
		if (
			businessVerificationDetails?.data?.businessEntityVerification ||
			businessDetailFacts
		) {
			// get business age by converting it into years from formation date
			const businessVerificationAge = businessVerificationDetails?.data
				?.businessEntityVerification?.year
				? new Date().getFullYear() -
					Number(
						businessVerificationDetails?.data?.businessEntityVerification?.year,
					)
				: null;
			const age = businessVerificationDetails?.data?.businessEntityVerification
				?.formation_date
				? new Date().getFullYear() -
					Number(
						convertToLocalDate(
							businessVerificationDetails?.data?.businessEntityVerification
								?.formation_date ?? "",
							"YYYY",
						),
					)
				: null;
			const factsAge = businessDetailFacts?.year_established?.value
				? new Date().getFullYear() -
					Number(businessDetailFacts?.year_established.value)
				: null;
			setBusinessAge(factsAge ?? age ?? businessVerificationAge);
		}
	}, [businessVerificationDetails, businessDetailFacts]);

	const { data: equifaxData } = useGetEquifax({
		businessId: applicantData?.data.business_id ?? "",
		customerId,
		caseId: applicantData?.data?.id,
	});

	const { data: kybFactsData, isLoading: kybFactsDataLoading } = useGetFactsKyb(
		applicantData?.data?.business_id ?? "",
	);

	return (
		<>
			<Business
				applicantData={applicantData?.data}
				business={applicantData?.data.business}
				businessAge={businessAge ?? 0}
				publicRecords={publicRecords}
				businessVerificationDetails={businessVerificationDetails}
				businessNames={applicantData?.data?.business_names}
				businessAddresses={
					Array.isArray(businessDetailFacts?.mailing_address?.value) &&
					businessDetailFacts?.mailing_address?.value?.length > 0
						? businessDetailFacts.mailing_address.value
						: applicantData?.data?.business_addresses
				}
				kybFactsData={kybFactsData?.data}
				factsKYBLoading={kybFactsDataLoading}
				businessDetailFacts={businessDetailFacts}
			/>
			<Owners
				equifaxData={equifaxData}
				owners={applicantData?.data?.owners}
				businessId={applicantData?.data?.business.id}
				customerId={customerId}
				caseId={caseId}
			/>
			<Industry
				business={applicantData?.data.business}
				businessDetailFacts={businessDetailFacts}
			/>
			{isNpiEnabled && <NPI businessNpiData={businessNpiData?.data} />}

			<WebsiteReview
				businessWebsiteData={businessWebsiteData}
				loading={businessWebsiteDataLoading}
				guestOwnerEdited={applicantData?.data?.guest_owner_edits?.includes(
					"official_website",
				)}
			/>
			{applicantData?.data?.guest_owner_edits?.length && (
				<div className="flex flex-row p-4 font-normal tracking-tight font-inter">
					<div className="flex items-center justify-center h-10 text-sm bg-blue-50 min-w-10">
						†
					</div>
					<div className="ml-4 text-xs ">
						Denotes fields that were filled out internally. These fields are
						only visible to applicants on documents that required an e-signature
						and have been mapped accordingly. For additional information, please
						reach out to your Worth representative.
					</div>
				</div>
			)}
		</>
	);
};

export default CompanyProfile;
