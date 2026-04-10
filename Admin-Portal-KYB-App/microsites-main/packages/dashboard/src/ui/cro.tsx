import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { type MultiValue } from "react-select";
import { useFlags } from "launchdarkly-react-client-sdk";
import queryString from "query-string";
import { checkFeatureAccess, concatString } from "@/lib/helper";
import { getItem } from "@/lib/localStorage";
import { type TOption } from "@/lib/types/common";
import { cn } from "@/lib/utils";
import { type Industry } from "@/services/api/dashboard.service";
import {
	useGetIndustryList,
	useGetUsers,
} from "@/services/queries/dashboard.query";
import { ApplicationsReceivedVsApprovedGraph } from "./applications-received-vs-approved-graph";
import { AverageWorthScore } from "./average-worth-score";
import { CasesInProgress } from "./cases-in-progress";
import { type TableData } from "./cases-table";
import CaseTable from "./CaseTable";
import { CountOfBusinesses } from "./count-of-businesses";
import { IndustryExposureChart } from "./IndustryExposureChart";
import { Label } from "./label";
import MultiSelectV2 from "./multi-select-v2";
import { PortfolioLevelScore } from "./portfolio-level-score";
import { RadioGroup, RadioGroupItem } from "./radio-group";
import { ReasonsRiskAlerts } from "./reasons-risk-alerts";
import { Select, SelectContent, SelectItem, SelectTrigger } from "./select";
import * as TopTabs from "./tabs-old";
import { TimeToApproval } from "./time-to-approval";
import { TotalApplications } from "./total-applications-chart";
import { TotalCases } from "./total-cases";

import FEATURE_FLAGS from "@/constants/FeatureFlags";
import { LOCALSTORAGE } from "@/constants/LocalStorage";

interface User {
	id: string;
	name: string;
}

type UserLevel = "cro" | "risk-analyst";

// type Industry = (typeof industries)[number];

export type TimeFilterPeriod = "DAY" | "WEEK" | "MONTH" | "YEAR";

const displayCustomerUsers = checkFeatureAccess("customer_user:read");

function TimeFilter({
	value,
	onChange,
}: {
	value: TimeFilterPeriod;
	onChange: (value: TimeFilterPeriod) => void;
}) {
	return (
		<RadioGroup
			value={value}
			onValueChange={(value: any) => {
				onChange(value as TimeFilterPeriod);
			}}
			className="inline-flex items-center p-1 rounded-md bg-secondary"
		>
			<div className="grid grid-cols-4 gap-1">
				{(
					[
						{ value: "DAY", label: "24 Hours" },
						{ value: "WEEK", label: "7 Days" },
						{ value: "MONTH", label: "30 Days" },
						{ value: "YEAR", label: "1 Year" },
					] satisfies Array<{ value: TimeFilterPeriod; label: string }>
				).map(({ value: optionValue, label }) => (
					<Label
						key={optionValue}
						htmlFor={optionValue}
						className={cn(
							"px-4 py-2 rounded-lg text-sm font-normal text-center cursor-pointer transition-colors text-gray-800 h-[44px] flex items-center justify-center",
							value === optionValue ? "bg-blue-100 text-blue-600" : undefined,
						)}
					>
						<RadioGroupItem
							value={optionValue}
							id={optionValue}
							className="sr-only"
						/>
						{label}
					</Label>
				))}
			</div>
		</RadioGroup>
	);
}

const ALL_INDUSTRIES = "all-industries";

export function CRO(props: {
	customerId: string;
	level: UserLevel;
	users: User[];
	tableData: TableData[];
}) {
	const flags = useFlags();
	const [searchParams, setSearchParams] = useSearchParams();
	const subrole = getItem(LOCALSTORAGE.subrole) as {
		id: string;
		code: "risk_analyst" | "owner" | "cro";
		label: "Risk Analyst" | "Owner" | "CRO";
	};
	const currentUserId = getItem(LOCALSTORAGE.userId) as string;
	// selected user
	const [period, setPeriod] = useState<TimeFilterPeriod>("WEEK");
	const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
	const [customerUsers, setCustomerUsers] = useState<TOption[]>([]);
	const [selectedIndustry, setSelectedIndustry] =
		useState<Industry["id"]>(ALL_INDUSTRIES);
	const [industries, setIndustries] = useState<any[]>([]);

	const { data: industryListData } = useGetIndustryList();

	useEffect(() => {
		const industryList = industryListData?.data?.records ?? [];

		const updatedIndustryList = [
			{
				id: ALL_INDUSTRIES,
				name: "All Industries",
				value: "all",
				label: "All Industries",
				code: "all",
				sector_code: "",
				created_at: new Date(),
				updated_at: new Date(),
			},
			...industryList,
		];

		setIndustries(updatedIndustryList);
	}, [industryListData]);

	const { data: customerUsersDataResponse } = useGetUsers(
		props.customerId,
		queryString.stringify({
			"filter[status][0]": "ACTIVE",
			pagination: false,
		}),
		displayCustomerUsers,
	);

	useEffect(() => {
		if (customerUsersDataResponse) {
			const customerUsersData = customerUsersDataResponse.data.records.reduce(
				(
					acc: TOption[],
					item: { id: string; first_name: string; last_name: string },
				) => {
					acc.push({
						label: concatString([item.first_name, item.last_name]),
						value: item.id,
					});

					return acc;
				},
				[],
			);
			setCustomerUsers([
				{
					label: "Unassigned",
					value: "unassigned",
				},
				...customerUsersData,
			]);
		}
	}, [customerUsersDataResponse]);

	const defaultTab = useMemo(
		() =>
			subrole.code === "risk_analyst" ? "risk-analysis" : "team-performance",
		[subrole],
	);
	const tab = useMemo(
		() => searchParams.get("tab") ?? defaultTab,
		[searchParams, defaultTab],
	);

	const shouldPauseTransition =
		flags[FEATURE_FLAGS.PAT_926_PAUSE_DECISIONING] ?? false;

	const handleTabChange = (next: string) => {
		setSearchParams(
			(prev) => {
				prev.delete("tab");
				if (next === "pipeline" || next === "risk-analysis") {
					prev.delete("filter_date");
					prev.delete("page");
				}
				prev.append("tab", next);
				return prev;
			},
			{ replace: true },
		);
	};

	// Config-driven tabs definition
	const tabConfig = useMemo(() => {
		return [
			{
				value: "pipeline",
				label: "Pipeline",
				show: !shouldPauseTransition,
				content: (
					<TopTabs.TabsContent value="pipeline" className="space-y-4">
						<CROTopArea>
							<div className="flex items-center gap-4">
								<TimeFilter value={period} onChange={setPeriod} />
							</div>
							<Select
								value={selectedIndustry}
								onValueChange={(value) => {
									setSelectedIndustry(value);
								}}
							>
								<SelectTrigger className="max-w-[400px] min-w-[200px] p-4 font-semibold truncate bg-white h-[44px]">
									{industries.find((i) => i.id === selectedIndustry)?.name ??
										"Select Industry"}
								</SelectTrigger>
								<SelectContent>
									{industries.map((industry) => (
										<SelectItem key={industry.id} value={industry.id}>
											{industry.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</CROTopArea>

						<div className="grid grid-cols-3 gap-4">
							<div className="col-span-2">
								<ApplicationsReceivedVsApprovedGraph
									customerId={props.customerId}
									period={period}
									industries={
										selectedIndustry && selectedIndustry !== ALL_INDUSTRIES
											? [selectedIndustry]
											: []
									}
								/>
							</div>
							<div className="col-span-1">
								<TotalApplications
									customerId={props.customerId}
									period={period}
									industries={
										selectedIndustry && selectedIndustry !== ALL_INDUSTRIES
											? [selectedIndustry]
											: []
									}
								/>
							</div>
							<div className="col-span-full">
								<TimeToApproval
									customerId={props.customerId}
									period={period}
									className="col-span-2"
									industries={
										selectedIndustry && selectedIndustry !== ALL_INDUSTRIES
											? [selectedIndustry]
											: []
									}
								/>
							</div>
						</div>
					</TopTabs.TabsContent>
				),
			},
			{
				value: "team-performance",
				label:
					subrole.code !== "risk_analyst"
						? "Team Performance"
						: "My Performance",
				show: !shouldPauseTransition,
				content: (
					<TopTabs.TabsContent value="team-performance" className="space-y-4">
						<CROTopArea>
							<TimeFilter value={period} onChange={setPeriod} />
							{subrole.code !== "risk_analyst" && (
								<MultiSelectV2
									placeholder="Team Members"
									className="w-auto bg-white"
									options={
										customerUsers as MultiValue<{
											label: string;
											value: string;
										}>
									}
									onValueChange={(value) => {
										const values = value.map((item) => item?.value) ?? [];
										setSelectedUserIds(values);
									}}
								/>
							)}
						</CROTopArea>
						<div className="grid grid-cols-3 gap-4">
							<div className="col-span-2">
								<ApplicationsReceivedVsApprovedGraph
									customerId={props.customerId}
									period={period}
									assignees={selectedUserIds}
								/>
							</div>
							<div className="col-span-1">
								<TimeToApproval
									customerId={props.customerId}
									period={period}
									className="col-span-2"
									assignees={selectedUserIds}
								/>
							</div>
						</div>
						<CaseTable period={period} assignees={selectedUserIds} />
					</TopTabs.TabsContent>
				),
			},
			{
				value: "risk-analysis",
				label: "Risk Analysis",
				show: true,
				content: (
					<TopTabs.TabsContent value="risk-analysis">
						<div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-4">
							<AverageWorthScore customerId={props.customerId} />
							<CasesInProgress customerId={props.customerId} />
							<CountOfBusinesses customerId={props.customerId} />
							<div className="md:col-span-2">
								<PortfolioLevelScore customerId={props.customerId} />
							</div>
							<TotalCases customerId={props.customerId} />
							<div className="md:col-span-2">
								<IndustryExposureChart customerId={props.customerId} />
							</div>
							<ReasonsRiskAlerts customerId={props.customerId} />
						</div>
					</TopTabs.TabsContent>
				),
			},
		];
	}, [
		subrole.code,
		period,
		selectedIndustry,
		industries,
		props.customerId,
		customerUsers,
		selectedUserIds,
	]);
	useEffect(() => {
		// if subrole is risk analyst, set selected user id to current user id as risk analyst should access only his assigned cases
		if (subrole.code === "risk_analyst") {
			setSelectedUserIds([currentUserId]);
		}
	}, [subrole, currentUserId]);

	return (
		<div className="p-4 bg-gray-100">
			{(() => {
				const visibleTabs = tabConfig.filter((t) => t.show);
				// If only one tab is visible, render its content without tab list/navigation
				if (visibleTabs.length === 1) {
					return (
						<TopTabs.Tabs value={visibleTabs[0].value}>
							{visibleTabs[0].content}
						</TopTabs.Tabs>
					);
				}
				// Otherwise render full tabs navigation
				return (
					<TopTabs.Tabs value={tab} onValueChange={handleTabChange}>
						<TopTabs.TabsList>
							{visibleTabs.map((t) => (
								<TopTabs.TabsTrigger key={t.value} value={t.value}>
									{t.label}
								</TopTabs.TabsTrigger>
							))}
						</TopTabs.TabsList>
						<hr className="border-gray-200 mb-4" />
						{visibleTabs.map((t) => t.content)}
					</TopTabs.Tabs>
				);
			})()}
		</div>
	);
}

function CROTopArea(props: { children: React.ReactNode }) {
	return (
		<div className="flex flex-row items-center justify-between">
			{props.children}
		</div>
	);
}
