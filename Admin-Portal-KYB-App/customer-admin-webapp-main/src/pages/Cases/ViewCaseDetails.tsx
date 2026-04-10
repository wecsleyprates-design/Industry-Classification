import React, { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router";
import { LinkIcon } from "@heroicons/react/20/solid";
import { URL } from "constants/URL";
import PenIcon from "@/assets/PenIcon";
import BackIcon from "@/assets/svg/BackIcon";
import Button from "@/components/Button";
import Card from "@/components/Card";
import { TitleLeftDivider } from "@/components/Dividers";
import FullPageLoader from "@/components/Spinner/FullPageLoader";
import PageTitle from "@/components/Title";
import useCustomToast from "@/hooks/useCustomToast";
import { getCurrentTimezone, getSlugReplacedURL } from "@/lib/helper";
import { getItem } from "@/lib/localStorage";
import {
	useGetInviteQuery,
	useResendInviteQuery,
} from "@/services/queries/auth.query";
import { useGetCaseByIdQuery } from "@/services/queries/case.query";
import useAuthStore from "@/store/useAuthStore";
import { type GetInvite } from "@/types/auth";

import { ACCESS, MODULES } from "@/constants/Modules";

interface IContentProps {
	applicantData: Record<string, any>;
	isLoading: boolean;
}

const Content: React.FC<IContentProps> = ({ isLoading, applicantData }) => {
	return (
		<React.Fragment>
			{isLoading && <FullPageLoader />}
			<div>
				<div className="pt-2">
					<TitleLeftDivider text="Personal details"></TitleLeftDivider>
				</div>
				<div className="grid grid-cols-1 mx-2 mt-10 mb-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
					<div>
						<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
							First name
						</p>
						<p className="py-2 text-sm font-medium tracking-tight text-slate-800">
							{applicantData?.applicant?.first_name as string}
						</p>
					</div>
					<div>
						<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
							Last name
						</p>
						<p className="py-2 text-sm font-medium tracking-tight text-slate-800">
							{applicantData?.applicant?.last_name as string}
						</p>
					</div>
					<div>
						<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
							Email
						</p>
						<p className="py-2 text-sm font-medium tracking-tight break-words text-slate-800 lg:break-all lg:w-36 xl:w-52 2xl:break-normal">
							{applicantData?.applicant?.email as string}
						</p>
					</div>
					<div>
						<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
							Mobile number
						</p>
						<p className="py-2 text-sm font-medium tracking-tight text-slate-800">
							{(applicantData?.applicant?.mobile as string) ?? "-"}
						</p>
					</div>
				</div>
				<div className="pt-2">
					<TitleLeftDivider text="Business details"></TitleLeftDivider>
				</div>
				<div className="grid grid-cols-1 mx-2 mt-10 mb-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
					<div>
						<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
							Business name
						</p>
						<p className="py-2 text-sm font-medium tracking-tight text-slate-800">
							{applicantData?.business?.name as string}
						</p>
					</div>
					<div>
						<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
							Business contact number (optional)
						</p>
						<p className="py-2 text-sm font-medium tracking-tight text-slate-800">
							{(applicantData?.business?.mobile as string) ?? "-"}
						</p>
					</div>
				</div>
			</div>
		</React.Fragment>
	);
};
const useQuery = () => {
	return new URLSearchParams(useLocation().search);
};
const ViewDetails = () => {
	const queryParams = useQuery();
	const tab = queryParams.get("tab");
	const { errorHandler, successHandler } = useCustomToast();
	const [applicantData, setUserData] = useState(Object);
	const { slug } = useParams();
	const navigate = useNavigate();
	const permissions = useAuthStore((state) => state.permissions);

	const [customerId] = useState<string>(getItem("customerId") ?? "");
	const {
		mutateAsync: getInvite,
		isPending: getInviteLoading,
		error: getInviteError,
	} = useGetInviteQuery();
	const {
		mutateAsync: resendInvite,
		data: resendInviteData,
		isPending: resendInviteLoading,
		error: resendInviteError,
	} = useResendInviteQuery();
	const handleCopyLink = async () => {
		const obj: GetInvite = {
			customerId,
			applicantId: applicantData?.applicant_id,
			caseId: slug ?? "",
			businessId: applicantData?.business_id,
		};
		const response = await getInvite(obj);
		navigator.clipboard
			.writeText(response?.data?.invite_link)
			.then(() => {
				successHandler({ message: "Link copied" });
			})
			.catch((_err) => {
				errorHandler({ message: "Copy failed" });
			});
	};
	const {
		isLoading,
		data: getApplicantData,
		error: getApplicantError,
	} = useGetCaseByIdQuery({
		customerId,
		caseId: slug ?? "",
		params: { filter: { time_zone: getCurrentTimezone() } },
	});

	useEffect(() => {
		if (resendInviteError != null) {
			errorHandler(resendInviteError);
		}
	}, [resendInviteError]);

	useEffect(() => {
		if (getApplicantData) {
			const obj = getApplicantData.data;
			setUserData(obj);
		}
	}, [getApplicantData]);

	useEffect(() => {
		if (getApplicantError) {
			errorHandler(getApplicantError);
			navigate(URL.CASE);
		}
	}, [getApplicantError]);
	useEffect(() => {
		if (getInviteError) {
			errorHandler(getInviteError);
		}
	}, [getInviteError]);
	useEffect(() => {
		if (resendInviteData) {
			if (resendInviteData.status === "success") {
				successHandler({ message: resendInviteData?.message });
			} else if (resendInviteData.status === "fail") {
				errorHandler({ message: resendInviteData.message });
			}
		}
	}, [resendInviteData]);
	const Buttons = (
		<div className="grid grid-flow-row gap-2 sm:flex">
			<Button
				className="px-2 shadow-none"
				onClick={() => {
					try {
						if (window.opener && !window.opener.closed) {
							window.close();
						} else {
							navigate(`${URL.CASE}?tab=${tab ?? 1}`);
						}
					} catch {
						navigate(`${URL.CASE}?tab=${tab ?? 1}`);
					}
				}}
				outline={true}
				color="transparent"
			>
				<div className="flex content-center justify-center gap-2">
					<div className="self-center">
						<BackIcon />
					</div>
					<span className="text-xs font-medium text-black">Back to cases</span>
				</div>
			</Button>
			{applicantData?.status?.code === "INVITED" && (
				<Button
					className="z-0 px-2 border-0 shadow-none"
					outline={true}
					onClick={async () => {
						await handleCopyLink();
					}}
					color="transparent"
				>
					<div className="flex content-center justify-center gap-2">
						<LinkIcon className="w-4 h-4 text-slate-700" />

						<span className="text-xs font-medium text-slate-700">
							Copy Link
						</span>
					</div>
				</Button>
			)}
			{(applicantData?.status?.code === "INVITED" ||
				applicantData?.status?.code === "INVITE_EXPIRED") && (
				<Button
					color="dark"
					isLoading={resendInviteLoading}
					onClick={async () => {
						await resendInvite({
							customerId,
							applicantId: applicantData?.applicant_id,
							caseId: slug ?? "",
							businessName: applicantData?.business?.name,
							businessId: applicantData?.business_id,
						});
					}}
				>
					<div className="flex content-center justify-center gap-2">
						<div className="flex items-center gap-1">
							<span className="text-xs font-medium text-white">
								Resend invite
							</span>
						</div>
					</div>
				</Button>
			)}
			{permissions[MODULES.CUSTOMER_USER]?.write && ACCESS.WRITE ? (
				<Button
					color="dark"
					className="px-2"
					onClick={() => {
						navigate(getSlugReplacedURL(URL.EDIT_CASE, slug ?? ""));
					}}
				>
					<div className="flex content-center justify-center gap-2 cursor-pointer">
						<div className="self-center">
							<PenIcon />
						</div>
						<span className="text-xs font-medium text-white">Edit</span>
					</div>
				</Button>
			) : (
				<></>
			)}
		</div>
	);

	return permissions[MODULES.CASES]?.read ? (
		<React.Fragment>
			{(isLoading || getInviteLoading) && <FullPageLoader />}
			<Card
				headerComponent={
					<PageTitle
						backLocation={`${URL.CASE}?tab=${tab ?? 1}`}
						titleText={slug}
						buttons={Buttons}
						isBackAllowed={false}
					/>
				}
				contentComponent={
					<Content isLoading={isLoading} applicantData={applicantData} />
				}
			/>
		</React.Fragment>
	) : (
		<Navigate to={URL.CASE} replace={true} />
	);
};

export default ViewDetails;
