import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { AgingThresholdsModal } from "@/components/AgingThresholds";
import { useGetBusinessCasesQuery } from "@/services/queries/businesses.query";
import {
	type PlatformType,
	useAppContextStore,
} from "@/store/useAppContextStore";
import { type IGetBusinessCases } from "@/types/business";
import { type IPayload } from "@/types/common";
import CaseTable from ".";

const BusinessCaseTable = ({
	platform,
	isAgingThresholdsModalOpen,
	handleCloseAgingThresholdsModal,
}: {
	platform?: PlatformType;
	isAgingThresholdsModalOpen?: boolean;
	handleCloseAgingThresholdsModal?: () => void;
}) => {
	const { slug } = useParams<{ slug: string }>();
	const [payload, setPayload] = useState<IPayload>({});
	const { customerId } = useAppContextStore();
	const { setModuleType, setPlatformType, setBusinessId, platformType } =
		useAppContextStore();

	const {
		data: businessCasesData,
		isLoading: isLoadingCaseData,
		refetch,
	} = useGetBusinessCasesQuery({
		customerID: customerId,
		businessId: slug ?? "",
		params: payload,
		platformType,
	} as IGetBusinessCases);

	const updatePayload = (newPayload: IPayload) => {
		setPayload(newPayload);
	};

	useEffect(() => {
		// set module and platform type in global store
		setModuleType("business_case");
		setBusinessId(slug ?? null);
		setPlatformType(platform ?? "admin");
	}, [setModuleType, platform, slug, setPlatformType]);

	return (
		<>
			<CaseTable
				customerCasesData={businessCasesData}
				isLoadingCaseData={isLoadingCaseData}
				updatePayload={updatePayload}
				refetchTableData={async () => {
					await refetch();
				}}
				customerId={customerId}
				businessId={slug ?? ""}
			/>

			{isAgingThresholdsModalOpen && (
				<AgingThresholdsModal
					isOpen={isAgingThresholdsModalOpen}
					onClose={handleCloseAgingThresholdsModal}
					showBanner={false}
					businessId={slug ?? ""}
					customerId={customerId}
				/>
			)}
		</>
	);
};

export default BusinessCaseTable;
