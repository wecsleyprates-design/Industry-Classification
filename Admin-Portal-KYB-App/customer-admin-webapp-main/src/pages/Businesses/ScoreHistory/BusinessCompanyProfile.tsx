import { useEffect, useState } from "react";
import TableLoader from "@/components/Spinner/TableLoader";
import { convertToLocalDate } from "@/lib/helper";
import { getItem } from "@/lib/localStorage";
import Business from "@/pages/Cases/CompanyProfile/Business";
import Industry from "@/pages/Cases/CompanyProfile/Industry";
import Owners from "@/pages/Cases/CompanyProfile/Owners";
import WebsiteReview from "@/pages/Cases/CompanyProfile/WebsiteReview";
import { useGetBusinessById } from "@/services/queries/businesses.query";
import {
	useGetBusinessVerificationDetails,
	useGetBusinessWebsite,
	useGetEquifax,
} from "@/services/queries/integration.query";
import { type PublicRecordsResponse } from "@/types/publicRecords";

import { LOCALSTORAGE } from "@/constants/LocalStorage";

interface ICompanyProfileProps {
	businessId: string;
	scoreTriggerId?: string;
	publicRecords?: PublicRecordsResponse;
	caseId?: string;
}

const BusinessCompanyProfile: React.FC<ICompanyProfileProps> = ({
	businessId,
	scoreTriggerId,
	publicRecords,
	caseId,
}) => {
	const customerId: string = getItem(LOCALSTORAGE.customerId) ?? "";
	const [businessAge, setBusinessAge] = useState<number | null>(null);
	const { data: businessApiData, isLoading } = useGetBusinessById({
		businessId: businessId ?? "",
		fetchOwnerDetails: true,
	});

	const { data: businessWebsiteData, isLoading: businessWebsiteDataLoading } =
		useGetBusinessWebsite({
			businessId,
			scoreTriggerId,
		});

	const { data: businessVerificationDetails } =
		useGetBusinessVerificationDetails(businessId);

	useEffect(() => {
		if (businessVerificationDetails) {
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
			setBusinessAge(age ?? businessVerificationAge);
		}
	}, [businessVerificationDetails]);

	const { data: equifaxData } = useGetEquifax({
		businessId: businessId ?? "",
		customerId,
		scoreTriggerId,
	});
	return (
		<>
			{isLoading ? (
				<div className="flex justify-center py-2 tracking-tight">
					<TableLoader />
				</div>
			) : (
				<>
					<Business
						business={businessApiData?.data}
						businessAge={businessAge ?? 0}
						publicRecords={publicRecords}
						businessVerificationDetails={businessVerificationDetails}
						businessNames={businessApiData?.data?.business_names}
						businessAddresses={businessApiData?.data?.business_addresses}
					/>

					<Owners
						equifaxData={equifaxData}
						owners={businessApiData?.data?.owners ?? []}
						businessId={businessId}
						customerId={customerId}
						caseId={caseId ?? ""}
					/>

					<Industry business={businessApiData?.data} />

					<WebsiteReview
						businessWebsiteData={businessWebsiteData}
						loading={businessWebsiteDataLoading}
					/>
				</>
			)}
		</>
	);
};

export default BusinessCompanyProfile;
