import React, { type FC } from "react";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/20/solid";
import { twMerge } from "tailwind-merge";
import ConditionalPlusIcon from "@/assets/ConditionalPlusIcon";
import StatusBadge from "@/components/Badge/StatusBadge";
import BusinessWebsitePage from "@/components/BusinessWebsite";
import { TitleLeftDivider } from "@/components/Dividers";
import TableLoader from "@/components/Spinner/TableLoader";
import { convertToLocalDate } from "@/lib/helper";
import { type BusinessWebsiteResponse } from "@/types/integrations";

import { GuestOwnerStyle } from "@/constants/TailwindStyles";

interface Props {
	businessWebsiteData?: BusinessWebsiteResponse;
	loading?: boolean;
	guestOwnerEdited?: boolean;
}

const WebsiteReview: FC<Props> = ({
	businessWebsiteData,
	loading,
	guestOwnerEdited,
}) => {
	const RenderContent = () => {
		if (loading) {
			return (
				<div className="flex justify-center py-2 tracking-tight">
					<TableLoader />
				</div>
			);
		}

		if (!businessWebsiteData?.data?.domain) {
			return (
				<div className="flex justify-center w-full text-sm text-gray-500">
					No website data found
				</div>
			);
		}

		return (
			<div className="px-6 py-5 border border-gray-300 rounded-xl">
				<div className="pb-5 text-base font-semibold">Website Details</div>
				<hr />
				<div className="grid items-center grid-cols-2 py-3 gap-y-3">
					<div className="text-xs font-medium text-gray-500">Website</div>
					<a
						target="_blank"
						href={getWebsiteUrl()}
						rel="noopener noreferrer"
						className={twMerge(
							"flex flex-row items-center text-sm font-medium text-blue-600",
							guestOwnerEdited && GuestOwnerStyle,
						)}
					>
						<span className="truncate">
							{getWebsiteUrl()}
							<ConditionalPlusIcon isNotapplicant={!!guestOwnerEdited} />
						</span>
						<ArrowTopRightOnSquareIcon className="h-4 ml-2 text-blue-600 min-w-4" />
					</a>
					<hr className="col-span-2" />
					<div className="text-xs font-medium text-gray-500">Status</div>
					<StatusBadge
						text={
							typeof businessWebsiteData?.data?.status === "string"
								? businessWebsiteData?.data?.status === "online"
									? "Online"
									: "Offline"
								: "Unknown"
						}
						type={
							typeof businessWebsiteData?.data?.status === "string"
								? businessWebsiteData?.data?.status === "online"
									? "active"
									: "inactive"
								: "inactive"
						}
						className="w-min"
					/>
					<hr className="col-span-2" />
					<div className="text-xs font-medium text-gray-500">Creation Date</div>
					<div className="text-sm text-gray-800 ">
						{businessWebsiteData?.data?.domain?.creation_date
							? convertToLocalDate(
									businessWebsiteData?.data?.domain?.creation_date,
									"MM/DD/YYYY",
								)
							: "-"}
					</div>
					<hr className="col-span-2" />
					<div className="text-xs font-medium text-gray-500">
						Expiration Date
					</div>
					<div className="text-sm text-gray-800">
						{businessWebsiteData?.data?.domain?.expiration_date
							? convertToLocalDate(
									businessWebsiteData?.data?.domain?.expiration_date,
									"MM/DD/YYYY",
								)
							: "-"}
					</div>
					<hr className="col-span-2" />
					<div className="text-xs font-medium text-gray-500">
						Parked Domain?
					</div>
					<div className="text-sm text-gray-800">
						{typeof businessWebsiteData?.data?.parked === "boolean"
							? businessWebsiteData?.data?.parked
								? "Yes"
								: "No"
							: "-"}
					</div>
				</div>
			</div>
		);
	};

	const getWebsiteUrl = () => {
		let websiteUrl = businessWebsiteData?.data?.url;

		if (!websiteUrl && businessWebsiteData?.data.pages?.length) {
			websiteUrl = businessWebsiteData?.data.pages[0].url;
		}

		if (!websiteUrl) {
			return "-";
		}

		return websiteUrl.startsWith("http") ? websiteUrl : `http://${websiteUrl}`;
	};

	return (
		<div>
			<div className="py-2 mb-4">
				<TitleLeftDivider text="Website Review" />
			</div>
			<RenderContent />
			{businessWebsiteData?.data?.pages?.length ? (
				<div className="px-6 pt-5 mt-6 border border-gray-300 rounded-xl">
					<div className="pb-6 mb-0.5 text-base font-semibold">
						Website Pages
					</div>
					<hr className="pb-6 mt-0.5" />
					{businessWebsiteData?.data?.pages?.map((page, index) => {
						return (
							<BusinessWebsitePage businessWebsitePageData={page} key={index} />
						);
					})}
				</div>
			) : null}
		</div>
	);
};

export default WebsiteReview;
