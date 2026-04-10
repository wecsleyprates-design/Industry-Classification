import React, { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import { useSearchParams } from "react-router-dom";
import { BetaOptInBanner } from "@/components/BetaSettings";
import { TabWithUiComponent } from "@/components/Tabs";
import useGlobalStore from "@/store/useGlobalStore";
import { type TabsInterface } from "@/types/common";

import { URL } from "@/constants/URL";

const TABS: TabsInterface[] = [
	{
		id: 1,
		name: "Queue",
		moduleName: "attention",
	},
	{
		id: 2,
		name: "All cases",
		moduleName: "all",
	},
	{
		id: 3,
		name: "Archived",
		moduleName: "archived",
	},
];

const CasesTabs = () => {
	const location = useLocation();
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const moduleName = searchParams.get("tableName");

	const setSavedPayload = useGlobalStore((store) => store.setSavedPayload);

	const [activeTab, setActiveTab] = useState<number>(1);
	const handleChangeTab = (val: number) => {
		setActiveTab(val);
		switch (val) {
			case 1:
				navigate(URL.CASE);
				break;
			case 2:
				navigate(URL.All_CASES);
				break;
			case 3:
				navigate(URL.ARCHIVED_CASES);
				break;
			default:
				navigate(URL.CASE);
				break;
		}
	};

	useEffect(() => {
		switch (location.pathname) {
			case URL.CASE:
				setActiveTab(1);
				break;
			case URL.All_CASES:
				setActiveTab(2);
				break;
			case URL.ARCHIVED_CASES:
				setActiveTab(3);
				break;
			default:
				setActiveTab(1);
				break;
		}
	}, [location.pathname]);

	useEffect(() => {
		if (moduleName) {
			switch (moduleName) {
				case "attention":
					break;
				case "all":
					navigate(URL.All_CASES);
					break;
				case "archived":
					navigate(URL.ARCHIVED_CASES);
					break;
				default:
					navigate(URL.CASE);
					break;
			}
		}
	}, [moduleName]);

	return (
		<>
			<BetaOptInBanner
				featureKey="case_management_v2"
				title="Case Management 2.0"
				description="A new and improved experience is available."
			/>
			<div className="mt-0 bg-white border rounded-lg shadow">
				<TabWithUiComponent
					headerContent={<></>}
					tabs={TABS}
					activeId={activeTab}
					onTabChange={(id: number) => {
						const payloadObj = {
							module: TABS[activeTab - 1]?.moduleName as string,
							values: searchParams,
						};
						setSavedPayload(payloadObj);
						handleChangeTab(id);
						setActiveTab(id);
					}}
				/>
				<Outlet />
			</div>
		</>
	);
};

export default CasesTabs;
