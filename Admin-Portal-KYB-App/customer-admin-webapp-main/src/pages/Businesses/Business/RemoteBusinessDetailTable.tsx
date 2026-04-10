import React, { type FC, Suspense } from "react";
import { getRemoteComponent } from "@/lib/helper";

const BusinessDetailTable = React.lazy(async () => {
	const module = await getRemoteComponent("case", "BusinessCaseTable");
	return { default: module.default };
}) as React.ComponentType<{
	platform: string;
	isAgingThresholdsModalOpen?: boolean;
	handleCloseAgingThresholdsModal?: () => void;
}>;

const RemoteBusinessDetailTable: FC<{
	isAgingThresholdsModalOpen?: boolean;
	handleCloseAgingThresholdsModal?: () => void;
}> = ({ isAgingThresholdsModalOpen, handleCloseAgingThresholdsModal }) => {
	return (
		<Suspense>
			<div className="-m-8">
				<BusinessDetailTable
					platform="customer"
					isAgingThresholdsModalOpen={isAgingThresholdsModalOpen}
					handleCloseAgingThresholdsModal={handleCloseAgingThresholdsModal}
				/>
			</div>
		</Suspense>
	);
};

export default RemoteBusinessDetailTable;
