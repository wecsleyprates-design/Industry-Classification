import React, { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import { CheckCircleIcon } from "@heroicons/react/20/solid";
import LinkIcon from "assets/LinkIcon";
import PenIcon from "assets/PenIcon";
import ThrashIcon from "assets/ThrashIcon";
import { isAxiosError } from "axios";
import { URL } from "constants/URL";
import Button from "@/components/Button";
import Card from "@/components/Card";
import { WarningModal } from "@/components/Modal";
import FullPageLoader from "@/components/Spinner/FullPageLoader";
import PageTitle from "@/components/Title/PageTitle";
import useCustomToast from "@/hooks/useCustomToast";
import { getSlugReplacedURL } from "@/lib/helper";
import { getItem } from "@/lib/localStorage";
import {
	useGetUserDetailsByIdQuery,
	useResendUserInviteQuery,
	useUpdateCustomerUserQuery,
} from "@/services/queries/user.query";
import useAuthStore from "@/store/useAuthStore";
import { STATUS_CODES } from "../../constants/StatusCodes";

import { MODULES } from "@/constants/Modules";

interface IContentProps {
	userData: Record<string, any>;
}

const Content: React.FC<IContentProps> = ({ userData }) => {
	return (
		<React.Fragment>
			<div>
				<div className="grid grid-cols-1 mx-2 my-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
					<div>
						<p className="text-[10px] font-normal text-gray-500 tracking-tight">
							First name
						</p>
						<p className="py-2 text-sm font-medium tracking-tight text-slate-800">
							{userData?.first_name as string}
						</p>
					</div>
					<div>
						<p className="text-[10px] font-normal text-gray-500 tracking-tight">
							Last name
						</p>
						<p className="py-2 text-sm font-medium tracking-tight text-slate-800">
							{userData?.last_name as string}
						</p>
					</div>
					<div>
						<p className="text-[10px] font-normal text-gray-500 tracking-tight">
							Email
						</p>
						<p className="py-2 text-sm font-medium tracking-tight break-words text-slate-800 lg:break-all lg:w-36 xl:w-52 2xl:break-normal">
							{userData?.email as string}
						</p>
					</div>
					<div>
						<p className="text-[10px] font-normal text-gray-500 tracking-tight">
							Mobile number
						</p>
						<p className="py-2 text-sm font-medium tracking-tight text-slate-800">
							{(userData?.mobile as string) ?? "-"}
						</p>
					</div>
				</div>
			</div>
		</React.Fragment>
	);
};

const UserDetails = () => {
	const navigate = useNavigate();
	const { slug } = useParams();
	const permissions = useAuthStore((state) => state.permissions);
	const { successHandler, errorHandler } = useCustomToast();
	const [loading, setLoading] = useState<boolean>(true);
	const [customerId] = useState<string>(getItem("customerId") ?? "");
	const [userData, setUserData] = useState(Object);
	const [warningModal, setWarningModal] = useState<boolean>(false);
	const {
		data: getUserData,
		error: getUserError,
		refetch: refetchUser,
		isLoading: isUserLoading,
	} = useGetUserDetailsByIdQuery(customerId ?? "", slug ?? "");
	useEffect(() => {
		if (getUserData) {
			setLoading(false);
			const obj = getUserData?.data;
			setUserData(obj);
		}
	}, [getUserData]);

	useEffect(() => {
		if (getUserError && isAxiosError(getUserError)) {
			setLoading(false);
			errorHandler(getUserError);
			if (getUserError?.response?.status !== STATUS_CODES.UNAUTHORIZED) {
				navigate(URL.USERS);
			}
		}
	}, [getUserError]);

	const {
		mutateAsync: deactivateUserAsync,
		data: deactivateUserData,
		isPending: deactivateUserLoading,
		error: deactivateUserError,
	} = useUpdateCustomerUserQuery();

	const toggleUserStatusHandler = async (action: "ACTIVE" | "INACTIVE") => {
		await deactivateUserAsync({
			customerId,
			userId: slug ?? "",
			body: {
				status: action,
			},
		});
	};

	useEffect(() => {
		if (deactivateUserData?.status === "success") {
			refetchUser()
				.then((res) => res)
				.catch((err) => {
					console.error(err);
				});
			successHandler({
				message: deactivateUserData?.message,
			});
		} else if (
			deactivateUserData?.data?.status === "error" ||
			deactivateUserData?.data?.status === "fail"
		) {
			errorHandler({
				message: deactivateUserData?.message,
			});
		}
	}, [deactivateUserData]);

	useEffect(() => {
		if (deactivateUserError) {
			errorHandler(deactivateUserError);
		}
	}, [deactivateUserError]);

	const {
		mutateAsync: resendUserInviteAsync,
		data: resendInviteData,
		isPending: resendInviteLoading,
		error: resendInviteError,
	} = useResendUserInviteQuery();

	useEffect(() => {
		if (resendInviteData?.status === "success") {
			successHandler({
				message: resendInviteData?.message,
			});
		} else if (
			resendInviteData?.status === "error" ||
			resendInviteData?.status === "fail"
		) {
			errorHandler({
				message: resendInviteData?.message,
			});
		}
	}, [resendInviteData]);

	useEffect(() => {
		if (resendInviteError) {
			errorHandler(resendInviteError);
		}
	}, [resendInviteError]);

	const handleCopyLink = () => {
		navigator.clipboard
			.writeText(window.location.href)
			.then(() => {
				successHandler({ message: `Link copied!!` });
			})
			.catch((_err) => {
				errorHandler({ message: "Link copy failed" });
			});
	};

	const Buttons = (
		<div className="grid grid-flow-row gap-2 sm:flex">
			{permissions[MODULES.CUSTOMER_USER]?.create &&
				getUserData?.data?.subrole?.code !== "owner" && (
					<>
						{userData?.status === "ACTIVE" && (
							<Button
								className="z-0 flex content-center justify-center gap-2 px-2 border-0 shadow-none "
								outline={true}
								color="transparent"
								onClick={() => {
									setWarningModal(true);
								}}
								icon={
									<div className="self-center">
										<ThrashIcon />
									</div>
								}
							>
								<span className="text-xs font-medium text-red-600">
									Deactivate
								</span>
							</Button>
						)}
						{userData?.status === "INACTIVE" && (
							<Button
								onClick={() => {
									setWarningModal(true);
								}}
								icon={<CheckCircleIcon className="w-4 h-4" />}
							>
								<span className="text-xs font-medium ">Activate</span>
							</Button>
						)}
					</>
				)}
			{userData?.status === "INVITED" && (
				<Button
					className="z-0 px-2 border-0 shadow-none"
					outline={true}
					onClick={async () => {
						handleCopyLink();
					}}
					color="transparent"
				>
					<div className="flex content-center justify-center gap-2">
						<div className="self-center">
							<LinkIcon />
						</div>
						<span className="text-xs font-medium text-slate-700">
							Copy Link
						</span>
					</div>
				</Button>
			)}
			{(userData?.status === "INVITED" ||
				userData?.status === "INVITE_EXPIRED" ||
				userData?.status === "INVITATION_REQUESTED") &&
				permissions[MODULES.CUSTOMER_USER]?.write && (
					<Button
						onClick={async () => {
							await resendUserInviteAsync({ customerId, userId: slug ?? "" });
						}}
						color="dark"
						isLoading={resendInviteLoading}
						className="text-xs font-medium text-white"
					>
						Resend invite
					</Button>
				)}
			{permissions[MODULES.CUSTOMER_USER]?.write &&
				getUserData?.data?.subrole?.code !== "owner" && (
					<Button
						color="dark"
						onClick={() => {
							navigate(getSlugReplacedURL(URL.EDIT_USER, slug ?? "")); // REPLACE STRING WITH VARIABLE
						}}
						icon={
							<div className="self-center cursor-pointer">
								<PenIcon />
							</div>
						}
					>
						<span className="text-xs font-medium text-white">Edit</span>
					</Button>
				)}
		</div>
	);

	return permissions[MODULES.CUSTOMER_USER]?.read ? (
		<React.Fragment>
			{(loading || deactivateUserLoading || isUserLoading) && (
				<FullPageLoader />
			)}
			{warningModal && (
				<WarningModal
					isOpen={warningModal}
					onClose={() => {
						setWarningModal(false);
					}}
					onSucess={async () => {
						await toggleUserStatusHandler(
							userData?.status === "INACTIVE" ? "ACTIVE" : "INACTIVE",
						);
					}}
					title={` ${
						userData?.status === "INACTIVE" ? "Activate" : "Deactivate"
					} user`}
					description={`Are you sure you want to ${
						userData?.status === "INACTIVE" ? "activate" : "deactivate"
					} this user?`}
					buttonText={
						userData?.status === "INACTIVE" ? "Activate" : "Deactivate"
					}
					type={userData?.status === "INACTIVE" ? "success" : "danger"}
				/>
			)}
			<Card
				headerComponent={
					<PageTitle
						titleText={`#${slug ?? ""}`}
						buttons={Buttons}
						backLocation={URL.USERS}
					/>
				}
				contentComponent={<Content userData={userData} />}
			/>
		</React.Fragment>
	) : (
		<Navigate to={URL.USERS} replace={true} />
	);
};

export default UserDetails;
