import React, { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import TabsUnderlineResponsive from "@/components/Tabs/TabsUnderlineResponsive";
import { getItem } from "@/lib/localStorage";
import Features from "./Settings/Features/Features";
import RiskMonitoringScoring from "./Settings/Scoring/RiskMonitoringScoring";

import { LOCALSTORAGE } from "@/constants/LocalStorage";
import { PLATFORM } from "@/constants/Platform";

const Settings = () => {
	const [searchParams, setSearchParams] = useSearchParams();
	const [activeTab, setActiveTab] = useState<number>(1);
	const { slug } = useParams();

	const storageCustomerId = getItem<string>(LOCALSTORAGE.customerId);
	const customerId = slug ?? storageCustomerId ?? "";
	const platform = slug ? PLATFORM.admin : PLATFORM.customer;

	useEffect(() => {
		const tab = searchParams.get("tab");
		if (tab === "risk-monitoring") {
			setActiveTab(2);
		} else if (tab === "features") {
			setActiveTab(1);
		}
	}, [searchParams]);

	const tabs: any = [
		{
			id: 1,
			name: "Features",
			content: (
				<div>
					<Features customerId={customerId} platform={platform} />
				</div>
			),
		},
		{
			id: 2,
			name: "Scoring & Alerts",
			content: (
				<div>
					<RiskMonitoringScoring customerId={customerId} platform={platform} />
				</div>
			),
		},
	].filter(Boolean);

	return (
		<div className="p-5 sm:pr-0 ">
			<TabsUnderlineResponsive
				tabs={tabs}
				activeId={activeTab}
				onTabChange={(id: number) => {
					setActiveTab(id);
					const newParams = new URLSearchParams(searchParams);
					if (id === 2) {
						newParams.set("tab", "risk-monitoring");
					} else {
						newParams.set("tab", "features");
					}
					setSearchParams(newParams);
				}}
			/>
		</div>
	);
};

export default Settings;
