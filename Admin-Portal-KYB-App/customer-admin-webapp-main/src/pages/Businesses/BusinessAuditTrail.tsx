import React, { useEffect } from "react";
import { Navigate, useParams } from "react-router";
import AuditTrail from "@/components/AuditTrail/AuditTrail";
import Card from "@/components/Card";
import FullPageLoader from "@/components/Spinner/FullPageLoader";
import PageTitle from "@/components/Title/PageTitle";
import useCustomToast from "@/hooks/useCustomToast";
import { convertToLocalDate } from "@/lib/helper";
import { useGetBusinessById } from "@/services/queries/businesses.query";
import useAuthStore from "@/store/useAuthStore";
import { type GetBusinessByIdData } from "@/types/business";

import { MODULES } from "@/constants/Modules";
import { URL } from "@/constants/URL";

const Content: React.FC<{ businessData: GetBusinessByIdData | undefined }> = ({
	businessData,
}) => {
	return (
		<React.Fragment>
			<div>
				<div className="grid grid-flow-row mx-2 overflow-visible sm:grid-flow-col">
					<div className="grid items-center grid-cols-2 gap-2 mb-2 sm:flex sm:flex-col sm:items-start">
						<p className="text-[10px] font-normal text-gray-500 tracking-tight">
							Onboarding Date
						</p>
						<p className="text-sm font-medium tracking-tight text-slate-800">
							{convertToLocalDate(
								businessData?.created_at ?? null,
								"MM-DD-YYYY - h:mmA",
							)}
						</p>
					</div>
				</div>
			</div>
		</React.Fragment>
	);
};

const BusinessAuditTrail = () => {
	const { slug } = useParams();

	const permissions = useAuthStore((state) => state.permissions);

	const {
		data: businessData,
		error: businessError,
		isLoading,
	} = useGetBusinessById({ businessId: slug ?? "" });

	const { errorHandler } = useCustomToast();

	useEffect(() => {
		if (businessError) {
			errorHandler(businessError);
		}
	}, [businessError]);

	const Buttons = (
		<div className="grid grid-flow-row gap-2 sm:flex">{<></>}</div>
	);

	return permissions[MODULES.BUSINESS]?.read ? (
		<React.Fragment>
			{isLoading && <FullPageLoader />}
			<Card
				headerComponent={
					<PageTitle
						titleText={`#${businessData?.data?.name ?? ""}`}
						buttons={Buttons}
					/>
				}
				contentComponent={<Content businessData={businessData?.data} />}
			/>
			<div className="flex flex-row w-full">
				<div className="w-full p-2 pt-2 mt-8 bg-white border rounded-lg shadow 6-2 sm:p-6 sm:w-2/5">
					{businessData && (
						<AuditTrail businessId={businessData?.data?.id ?? ""} />
					)}
				</div>
			</div>
		</React.Fragment>
	) : (
		<Navigate to={URL.AUTH_ERROR} />
	);
};

export default BusinessAuditTrail;
