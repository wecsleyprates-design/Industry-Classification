import React, { useEffect, useMemo } from "react";
import {
	generatePath,
	useLocation,
	useNavigate,
	useParams,
} from "react-router-dom";
import { useAppContextStore } from "@/store/useAppContextStore";
import { type CaseData } from "@/types/case";
import { type SosIntegrationTabProps, useTabsConfig } from "./hooks";

import { URL, VALUE_NOT_AVAILABLE } from "@/constants";
import { Badge } from "@/ui/badge";
import {
	SubTabs,
	SubTabsContent,
	SubTabsList,
	SubTabsTrigger,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@/ui/tabs";

export const CaseDetailsTabs: React.FC<{
	caseData?: CaseData;
	sosIntegration?: SosIntegrationTabProps;
}> = ({ caseData, sosIntegration }) => {
	const { id, mainTab: mainTabParam, subTab: subTabParam } = useParams();
	const { moduleType, platformType, customerId, businessId } =
		useAppContextStore();
	const navigate = useNavigate();
	const caseId = id ?? VALUE_NOT_AVAILABLE;
	const location = useLocation();
	const { tabsConfig, defaultMainTab, defaultSubTabs } = useTabsConfig(
		caseData,
		undefined,
		sosIntegration,
	);

	const tabs = Object.keys(tabsConfig);

	// Determine the active tabs based on URL params or defaults
	const activeMainTab = mainTabParam ?? defaultMainTab;
	const activeSubTab = subTabParam ?? defaultSubTabs[activeMainTab];

	// Base URL for case details, varies by platform and module type
	const caseDetailsBaseURL = useMemo(() => {
		if (platformType === "admin" && moduleType === "customer_case")
			return URL.CUSTOMER_APPLICANT_CASE_DETAILS;
		else if (platformType === "admin" && moduleType === "standalone_case") {
			return URL.STANDALONE_CASE_DETAILS;
		} else if (moduleType === "standalone_case") {
			return URL.STANDALONE_CASE_DETAILS;
		} else if (platformType === "admin" && moduleType === "business_case") {
			return URL.BUSINESS_APPLICANT_CASE_DETAILS;
		} else {
			return URL.CASE_DETAILS;
		}
	}, [platformType, moduleType]);

	// Function to handle main tab changes
	const handleMainTabChange = (newMainTab: string) => {
		const newSubTab = defaultSubTabs[newMainTab];
		const path = generatePath(caseDetailsBaseURL, {
			id: caseId,
			slug: customerId,
			mainTab: newMainTab,
			subTab: newSubTab,
			businessId,
		});
		navigate(path, { replace: true });
	};

	// Function to handle sub tab changes
	const handleSubTabChange = (newSubTab: string) => {
		const path = generatePath(caseDetailsBaseURL, {
			id: caseId,
			mainTab: activeMainTab,
			subTab: newSubTab,
			slug: customerId,
			businessId,
		});
		navigate(path, { replace: true });
	};

	// Ensure the URL reflects the initial default state if no params are present
	useEffect(() => {
		if (!mainTabParam) {
			const pathParams = {
				id: caseId,
				mainTab: defaultMainTab,
				slug: customerId,
				businessId,
			};

			const initialPath = generatePath(caseDetailsBaseURL, pathParams);
			navigate(
				{ pathname: initialPath, search: location.search },
				{ replace: true },
			); // Preserve existing query string (e.g., ?regenerateReport=1 from report failure email)
		}
	}, [
		caseId,
		mainTabParam,
		subTabParam,
		navigate,
		defaultMainTab,
		location.search,
		caseData?.business_id,
		caseDetailsBaseURL,
		customerId,
	]);

	return (
		<Tabs
			value={activeMainTab}
			onValueChange={handleMainTabChange}
			className="w-full bg-white"
		>
			<TabsList className="justify-start px-1">
				{tabs.map((tabKey) => {
					const tabConfig = tabsConfig[tabKey];
					return (
						<TabsTrigger key={tabKey} value={tabKey}>
							{tabConfig.label}
							{tabConfig.badge && (
								<Badge variant="secondary" className="ml-2">
									{tabConfig.badge}
								</Badge>
							)}
						</TabsTrigger>
					);
				})}
			</TabsList>

			{tabs.map((tabKey) => {
				const tabConfig = tabsConfig[tabKey];
				const subTabs = Object.keys(tabConfig.subTabs);
				const TabComponent = tabConfig.component;

				return (
					<TabsContent
						key={tabKey}
						value={tabKey}
						/**
						 * The combined CaseDetailsHeader and TabsContent is 7.5rem tall;
						 * the content should fill the remaining height of the viewport.
						 */
						className="p-4 min-h-[calc(100vh-7.5rem)]"
					>
						{subTabs.length > 0 ? (
							<SubTabs
								value={activeSubTab}
								onValueChange={handleSubTabChange}
								defaultValue={subTabs[0]}
							>
								<SubTabsList>
									{subTabs.map((subTabKey) => {
										const subTabConfig =
											tabConfig.subTabs[subTabKey];
										return (
											<SubTabsTrigger
												key={subTabKey}
												value={subTabKey}
											>
												{subTabConfig.label}
											</SubTabsTrigger>
										);
									})}
								</SubTabsList>
								{subTabs.map((subTabKey) => {
									const subTabConfig =
										tabConfig.subTabs[subTabKey];
									const SubTabComponent =
										subTabConfig.component;
									const subTabProps =
										subTabConfig.props || {};
									return (
										<SubTabsContent
											key={subTabKey}
											value={subTabKey}
										>
											<SubTabComponent
												caseId={caseId}
												{...subTabProps}
											/>
										</SubTabsContent>
									);
								})}
							</SubTabs>
						) : (
							TabComponent && (
								<TabComponent
									caseId={caseId}
									{...tabConfig.props}
								/>
							)
						)}
					</TabsContent>
				);
			})}
		</Tabs>
	);
};
