import React, { type FC, Suspense } from "react";
import { getRemoteComponent } from "@/lib/helper";

const MerchantProfilesTable = React.lazy(async () => {
	const module = await getRemoteComponent("case", "MerchantProfilesTable");
	return { default: module.default };
}) as React.ComponentType<{
	platform: string;
}>;

const RemoteMerchantProfilesTable: FC = () => {
	return (
		<Suspense>
			<MerchantProfilesTable platform={"customer"} />
		</Suspense>
	);
};

export default RemoteMerchantProfilesTable;
