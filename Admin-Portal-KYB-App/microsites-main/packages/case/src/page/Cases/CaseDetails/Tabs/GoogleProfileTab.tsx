import React from "react";
import {
	CheckCircleIcon,
	InformationCircleIcon,
	MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import CaseProgressOrScore from "@/components/CaseProgressOrScore/CaseProgressOrScore";
import useGetCaseDetails from "@/hooks/useGetCaseDetails";
import { useGetGoogleProfileByBusinessId } from "@/services/queries/integration.query";
import { useAppContextStore } from "@/store/useAppContextStore";
import { type GoogleProfileResponse } from "@/types/integrations";
import { CardList, CardListItem, NullState } from "../components";

import { VALUE_NOT_AVAILABLE } from "@/constants";
import { VerificationBadge } from "@/ui/badge";
import { BusinessLocationGoogleMap } from "@/ui/business-location-google-map";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Skeleton } from "@/ui/skeleton";

export interface GoogleProfileTabProps {
	caseId: string;
}

type MatchLevel = "match" | "partial" | "possible" | "not_found";

const normalizeMatchLevel = (match: string): MatchLevel => {
	switch (match?.toLowerCase()) {
		case "match found":
		case "match":
			return "match";
		case "partial match":
			return "partial";
		case "not found":
		case "not matched":
			return "not_found";
		case "possible match":
			return "possible";
		default:
			return "possible";
	}
};

const getMatchBadgeVariant = (level: MatchLevel) => {
	switch (level) {
		case "match":
			return "success";
		case "partial":
		case "possible":
			return "warning";
		case "not_found":
			return "error";
		default:
			return "default";
	}
};

const getMatchBadgeClass = (level: MatchLevel) => {
	switch (level) {
		case "match":
			return "bg-green-100 text-green-800";
		case "partial":
		case "possible":
			return "bg-yellow-100 text-yellow-800";
		case "not_found":
			return "bg-red-100 text-red-800";
		default:
			return "bg-gray-100 text-gray-800";
	}
};

const getAddressMatchBadge = (level: MatchLevel) => {
	switch (level) {
		case "match":
			return (
				<VerificationBadge
					variant="success"
					className={`bg-green-100 text-green-800`}
				>
					<CheckCircleIcon className="w-4 h-4" />
					Match
				</VerificationBadge>
			);
		case "partial":
		case "possible":
			return (
				<VerificationBadge
					variant="warning"
					className={`bg-yellow-100 text-yellow-800`}
				>
					<InformationCircleIcon className="w-4 h-4" />
					{level === "partial" ? "Partial Match" : "Possible Match"}
				</VerificationBadge>
			);
		case "not_found":
			return (
				<VerificationBadge
					variant="error"
					className={`bg-red-100 text-red-800`}
				>
					<InformationCircleIcon className="w-4 h-4" />
					No Match
				</VerificationBadge>
			);
		default:
			return null;
	}
};

type Details = Array<{
	label: string;
	value: React.ReactNode;
	badge?: React.ReactNode;
}>;

const DetailsCard: React.FC<{ details: Details }> = ({ details }) => (
	<CardContent>
		<CardList>
			{details.map((detail) => (
				<CardListItem
					key={detail.label}
					label={detail.label}
					value={detail.value}
					badge={detail.badge}
				/>
			))}
		</CardList>
	</CardContent>
);

const GoogleProfileSectionSkeleton: React.FC = () => (
	<Card>
		<div className="grid grid-cols-2 gap-4 mb-4">
			<Skeleton className="w-full h-[200px] rounded-xl" />
			<Skeleton className="w-full h-[200px] rounded-xl" />
		</div>

		<CardHeader className="px-4 py-2">
			<div className="flex items-center justify-between">
				<Skeleton className="w-32 h-6" />
				<Skeleton className="w-24 h-6" />
			</div>
		</CardHeader>

		<CardContent className="px-4 space-y-4">
			{Array.from({ length: 6 }).map((_, index) => (
				<div
					key={index}
					className="flex items-center justify-between py-2 border-b border-gray-100"
				>
					<Skeleton className="w-32 h-4" />
					<Skeleton className="w-40 h-4" />
				</div>
			))}
		</CardContent>
	</Card>
);

const GoogleProfileCard: React.FC<{ profile?: GoogleProfileResponse }> = ({
	profile,
}) => {
	const matchLevel = normalizeMatchLevel(profile?.business_match ?? "");
	const addressMatchLevel = normalizeMatchLevel(profile?.address_match ?? "");

	const businessName = profile?.google_profile.business_name;
	const address = profile?.google_profile.address;
	const phone = profile?.google_profile.phone_number;
	const website = profile?.google_profile.website;
	const profileUrl = profile?.google_profile.google_search_link;

	const geocodingDetails = profile?.google_profile.gps_coordinates;

	const formattedGoogleProfileDetails: Details = [
		{
			label: "Business Name",
			value: businessName,
		},
		{
			label: "Address",
			value: (
				<div className="flex items-center justify-between">
					<span>{address}</span>
				</div>
			),

			badge: getAddressMatchBadge(addressMatchLevel),
		},
		{
			label: "Phone Number",
			value: phone ?? VALUE_NOT_AVAILABLE,
		},
		{
			label: "Website",
			value: (
				<>
					{website ? (
						<a
							href={website}
							className="text-blue-600"
							target="_blank"
							rel="noopener noreferrer"
						>
							{website}
						</a>
					) : (
						VALUE_NOT_AVAILABLE
					)}
				</>
			),
		},
		{
			label: "Google Profile",
			value: (
				<a
					href={profileUrl}
					className="text-blue-600"
					target="_blank"
					rel="noopener noreferrer"
				>
					Link to Profile
				</a>
			),
		},
	];
	const mapLocation = geocodingDetails
		? {
				position: {
					lat: geocodingDetails.latitude,
					lng: geocodingDetails.longitude,
				},
				name: businessName ?? "",
				description: address ?? "",
			}
		: null;

	if (!profile || profile?.business_match === "Not Found") {
		return (
			<Card className="h-full pb-10 overflow-hidden">
				<NullState
					icon={
						<MagnifyingGlassIcon className="w-10 h-10 text-blue-600" />
					}
					title="No Google Profile Found"
					description={
						<>
							A Google Profile for this business could not be
							located <br /> based on the business name and
							address pairings <br /> associated to this case.
						</>
					}
				/>
			</Card>
		);
	}

	return (
		<Card className="overflow-hidden">
			<div className="flex flex-row h-52 mb-4">
				<img
					src={profile?.google_profile.thumbnail}
					alt="Business Thumbnail"
					className="w-auto h-full object-cover"
					loading="lazy"
					referrerPolicy="no-referrer"
				/>

				<BusinessLocationGoogleMap
					location={mapLocation}
					className="h-full w-full rounded-xl"
				/>
			</div>
			<CardHeader>
				<div className="flex items-center justify-between">
					<CardTitle className="font-medium text-gray-900">
						Google Profile
					</CardTitle>

					<VerificationBadge
						variant={getMatchBadgeVariant(matchLevel)}
						className={getMatchBadgeClass(matchLevel)}
					>
						{matchLevel === "match" && (
							<>
								<CheckCircleIcon />
								Match Found
							</>
						)}
						{(matchLevel === "partial" ||
							matchLevel === "possible") && (
							<>
								<InformationCircleIcon />
								Possible Match
							</>
						)}
					</VerificationBadge>
				</div>
			</CardHeader>
			<div>
				<DetailsCard details={formattedGoogleProfileDetails} />
				{(matchLevel !== "match" ||
					addressMatchLevel === "not_found") && (
					<div className="flex items-start gap-2 p-4 mx-5 mb-2 text-sm text-gray-600 rounded-md bg-gray-50">
						<InformationCircleIcon className="h-5 w-5 text-gray-400 mt-0.5" />
						<span>
							Please verify match by visiting the Google Profile
							link above.
						</span>
					</div>
				)}
			</div>
		</Card>
	);
};

export const GoogleProfileTab: React.FC<GoogleProfileTabProps> = ({
	caseId,
}) => {
	const { customerId } = useAppContextStore();
	const { caseData: caseDetailsData } = useGetCaseDetails({
		caseId,
		customerId,
	});

	const businessId = caseDetailsData?.data?.business.id;
	const { data: googleProfileData, isLoading: isProfileLoading } =
		useGetGoogleProfileByBusinessId(businessId ?? "");

	return (
		<div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
			<div className="flex flex-col col-span-1 gap-4 lg:col-span-7">
				{isProfileLoading ? (
					<GoogleProfileSectionSkeleton />
				) : (
					<GoogleProfileCard profile={googleProfileData?.data} />
				)}
			</div>
			<div className="flex flex-col col-span-1 gap-4 lg:col-span-5">
				<CaseProgressOrScore
					caseId={caseId}
					caseData={caseDetailsData}
				/>
			</div>
		</div>
	);
};
