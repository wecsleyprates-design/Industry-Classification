import React, { useEffect } from "react";
import { Navigate, useParams } from "react-router";
import * as qs from "qs";
import StatusBadge from "@/components/Badge/StatusBadge";
import Button from "@/components/Button";
import Card from "@/components/Card";
import FullPageLoader from "@/components/Spinner/FullPageLoader";
import PageTitle from "@/components/Title/PageTitle";
import useCustomToast from "@/hooks/useCustomToast";
import {
	capitalize,
	convertToLocalDate,
	getSlugReplacedURL,
	getStatusType,
} from "@/lib/helper";
import { getItem } from "@/lib/localStorage";
import {
	useGetInviteById,
	useResendBusinessInviteQuery,
} from "@/services/queries/businesses.query";
import useAuthStore from "@/store/useAuthStore";
import InvitesActivity from "./InvitesActivity";
import InvitesTable from "./InvitesTable";

import { LOCALSTORAGE } from "@/constants/LocalStorage";
import { MODULES } from "@/constants/Modules";
import { URL } from "@/constants/URL";

const Content: React.FC<Record<string, any>> = ({ inviteData }) => {
	return (
		<React.Fragment>
			<div>
				<div className="grid grid-flow-row sm:grid-flow-col mx-2 overflow-visible">
					<div className="grid grid-cols-2 sm:flex sm:flex-col sm:items-start items-center gap-2 mb-2">
						<p className="text-[10px] font-normal text-gray-500 tracking-tight">
							Invitation date
						</p>
						<p className="text-sm font-medium text-slate-800 tracking-tight">
							{convertToLocalDate(
								inviteData?.created_at as string,
								"MM-DD-YYYY - h:mmA",
							)}
						</p>
					</div>

					<div className="grid grid-cols-2 sm:flex sm:flex-col sm:items-start items-center gap-2 mb-2">
						<p className="text-[10px] font-normal text-gray-500 tracking-tight">
							Status
						</p>
						{inviteData?.status && (
							<div className="text-sm font-medium text-slate-800 tracking-tight overflow-hidden break-words">
								<div className="flex flex-row">
									<StatusBadge
										type={getStatusType(inviteData?.status)}
										text={capitalize(inviteData?.status as string)}
									/>
								</div>
							</div>
						)}
					</div>

					<div className="grid grid-cols-2 sm:flex sm:flex-col sm:items-start items-center gap-2 mb-2">
						<p className="text-[10px] font-normal text-gray-500 tracking-tight">
							Invited by
						</p>
						<p className="text-sm font-medium text-slate-800 tracking-tight overflow-hidden break-words">
							{String(inviteData?.first_name ?? "") +
								" " +
								String(inviteData?.last_name ?? "")}
						</p>
					</div>
				</div>
			</div>
		</React.Fragment>
	);
};

const InvitationDetails = () => {
	const { slug, inviteeId } = useParams();

	const permissions = useAuthStore((state) => state.permissions);
	const customerId: string = getItem(LOCALSTORAGE.customerId) ?? "";
	const params = {
		customer_id: customerId ?? "",
		business_id: slug ?? "",
		invitation_id: inviteeId ?? "",
	};

	const {
		data: inviteDetails,
		error: inviteError,
		isLoading: detailsLoading,
		refetch: refetchInviteDetails,
	} = useGetInviteById(qs.stringify(params));

	const { errorHandler, successHandler } = useCustomToast();

	const {
		mutateAsync: resendInvite,
		data: resendInviteData,
		isPending: resendInviteLoading,
		error: resendInviteError,
	} = useResendBusinessInviteQuery();

	useEffect(() => {
		if (resendInviteData) {
			if (resendInviteData.status === "success") {
				successHandler({ message: resendInviteData?.message });
			} else if (resendInviteData.status === "fail") {
				errorHandler({ message: resendInviteData.message });
			}
		}
	}, [resendInviteData]);

	useEffect(() => {
		if (resendInviteError != null) {
			errorHandler(resendInviteError);
		}
	}, [resendInviteError]);

	useEffect(() => {
		if (inviteError) {
			errorHandler(inviteError);
		}
	}, [inviteError]);

	const Buttons = (
		<div className="grid grid-flow-row sm:flex gap-2">
			{permissions[MODULES.BUSINESS]?.write && (
				<>
					<Button
						className="px-2"
						isLoading={resendInviteLoading}
						color="dark"
						onClick={() => {
							resendInvite({
								customerId: customerId ?? "",
								businessId: slug ?? "",
								invitationId: inviteeId ?? "",
							})
								.then(async () => {
									setTimeout(() => {
										refetchInviteDetails()
											.then()
											.catch(() => {});
									}, 2000);
								})
								.catch(() => {});
						}}
					>
						<div className="flex gap-2 justify-center content-center">
							<span className="font-medium text-xs text-white">Resend</span>
						</div>
					</Button>
				</>
			)}
		</div>
	);

	return permissions[MODULES.BUSINESS]?.read ? (
		<React.Fragment>
			{detailsLoading && <FullPageLoader />}
			<Card
				headerComponent={
					<PageTitle
						titleText={`#${inviteeId ?? ""}`}
						buttons={
							inviteDetails?.data?.invite_details?.status === "INVITED" ||
							inviteDetails?.data?.invite_details?.status === "EXPIRED" ? (
								Buttons
							) : (
								<></>
							)
						}
						backLocation={getSlugReplacedURL(URL.BUSINESS_DETAILS, slug ?? "")}
					/>
				}
				contentComponent={
					<Content inviteData={inviteDetails?.data?.invite_details} />
				}
			/>
			<div className="flex flex-row w-full">
				<div className="shadow mt-8 rounded-lg bg-white border mr-5 w-3/5">
					<InvitesTable
						data={inviteDetails?.data?.invitees ?? []}
						loading={detailsLoading}
					/>
				</div>
				{/* <div className="shadow mt-8 rounded-lg bg-white border mr-5 flex-1">
					<InvitesHistoryTable data={inviteDetails?.data?.history ?? []} />
				</div> */}
				<div className="shadow mt-8 rounded-lg bg-white border w-2/5">
					<InvitesActivity data={inviteDetails?.data?.history} />
				</div>
			</div>
		</React.Fragment>
	) : (
		<Navigate to={URL.AUTH_ERROR} />
	);
};

export default InvitationDetails;
