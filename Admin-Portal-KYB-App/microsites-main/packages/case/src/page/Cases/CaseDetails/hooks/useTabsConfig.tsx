import type React from "react";
import { useMemo } from "react";
import { type IntegrationStatus } from "@/hooks/useReRunIntegrationsForEditedFacts";
import { useGetRelatedBusinesses } from "@/services/queries/businesses.query";
import { useGetMatchProConnectionStatus } from "@/services/queries/integration.query";
import { type CaseData } from "@/types/case";
import {
	CaseAccountingBalanceSheetTab,
	CaseAccountingIncomeStatementTab,
	CaseAccountingUploadTab,
} from "../Tabs/Accounting";
import {
	AccountsTab,
	ProcessingHistoryTab,
	StatementsTab,
	type StatementsTabProps,
	TradeLinesTab,
	type TradeLinesTabProps,
	TransactionsTab,
	TrendsTab,
	type TrendsTabProps,
} from "../Tabs/Banking";
import { CaseDocumentsTab } from "../Tabs/case-documents-tab";
import { CustomFieldsTab } from "../Tabs/CustomFields";
import { ProcessorsTab } from "../Tabs/CustomFields/ProcessorsTab";
import {
	GoogleProfileTab,
	type GoogleProfileTabProps,
} from "../Tabs/GoogleProfileTab";
import {
	BackgroundTab,
	type BackgroundTabProps,
	BusinessRegistrationTab,
	type BusinessRegistrationTabProps,
	ContactInformationTab,
	type ContactInformationTabProps,
	MatchProTab,
	type MatchProTabProps,
	RelatedBusinessesTab,
	type RelatedBusinessesTabProps,
	WatchlistsTab,
	type WatchlistsTabProps,
	WebsiteTab,
	type WebsiteTabProps,
} from "../Tabs/KYB";
import { KycTab, type KycTabProps } from "../Tabs/KYC";
import { BusinessTaxesTab } from "../Tabs/Taxes";

import {
	CaseDetailsOverviewTab,
	type CaseDetailsOverviewTabProps,
} from "@/page/Cases/CaseDetails/Tabs/case-details-overview-tab";
import {
	AdverseMediaTab,
	type AdverseMediaTabProps,
	BrandManagementTab,
	type BrandManagementTabProps,
	PublicFilingsTab,
	type PublicFilingsTabProps,
} from "@/page/Cases/CaseDetails/Tabs/PublicRecords";

type TabConfig = {
	label: string;
	component: React.ComponentType<any> | null;
	props?: Record<string, any>;
	subTabs: Record<string, SubTabConfig>;
	badge: number | null;
	hidden?: boolean;
};

type SubTabConfig = {
	label: string;
	component: React.ComponentType<any>;
	props: Record<string, any>;
	hidden?: boolean;
};

// Define default tabs
const DEFAULT_MAIN_TAB = "overview";
const DEFAULT_SUB_TABS: Record<string, string> = {
	kyb: "background",
	"public-records": "google-profile",
	banking: "accounts",
	accounting: "income-statement",
	taxes: "business-taxes",
};

export type SosIntegrationTabProps = {
	integrationStatus: IntegrationStatus;
	isPending: boolean;
};

export const useTabsConfig = (
	caseData?: Pick<CaseData, "customer_id" | "business_id" | "custom_fields">,
	_mode?: "standalone_case" | "customer_case",
	sosIntegration?: SosIntegrationTabProps,
) => {
	const customerId = caseData?.customer_id ?? "";
	const businessId = caseData?.business_id ?? "";
	const { data: relatedBusinessesData } = useGetRelatedBusinesses(
		customerId,
		businessId,
	);
	const { data: matchProConnectionStatus } =
		useGetMatchProConnectionStatus(customerId);
	const hasRelatedBusinesses =
		(relatedBusinessesData?.data?.total_items ?? 0) > 0;

	/** Custom fields that don't have processor_ prefix */
	const hasCustomFields =
		Array.isArray(caseData?.custom_fields) &&
		caseData.custom_fields.some(
			(field) =>
				!field.internalName?.toLowerCase()?.startsWith("processor_"),
		);

	/** Custom fields that have processor_ prefix */
	const hasProcessorFields =
		Array.isArray(caseData?.custom_fields) &&
		caseData.custom_fields.some((field) =>
			field.internalName?.toLowerCase()?.startsWith("processor_"),
		);

	const isMatchProActive =
		matchProConnectionStatus?.data?.statusConnection?.details?.isActive ??
		false;

	return useMemo(() => {
		const tabsConfig: Record<string, TabConfig> = {
			overview: {
				label: "Overview",
				component: CaseDetailsOverviewTab,
				props: {
					// TODO: data and direction still needed from product team
					userOptions: [
						"Jane Smith",
						"Mike Johnson",
						"Michael Williams",
					],
				} satisfies Omit<CaseDetailsOverviewTabProps, "caseId">, // caseId is injected later for all components
				subTabs: {},
				badge: null,
			},
			kyb: {
				label: "KYB",
				component: null,
				props: {},
				subTabs: {
					background: {
						label: "Background",
						component: BackgroundTab,
						props: {} satisfies Omit<BackgroundTabProps, "caseId">,
					},
					"tax-id-sos": {
						label: "Business Registration",
						component: BusinessRegistrationTab,
						props: {
							integrationStatus:
								sosIntegration?.integrationStatus,
							isPending: sosIntegration?.isPending,
						} satisfies Omit<
							BusinessRegistrationTabProps,
							"caseId"
						>,
					},
					"business-summary": {
						label: "Contact Information",
						component: ContactInformationTab,
						props: {} satisfies Omit<
							ContactInformationTabProps,
							"caseId"
						>,
					},
					"website-review": {
						label: "Website",
						component: WebsiteTab,
						props: {} satisfies Omit<WebsiteTabProps, "caseId">,
					},
					watchlists: {
						label: "Watchlists",
						component: WatchlistsTab,
						props: {} satisfies Omit<WatchlistsTabProps, "caseId">,
					},
					"related-businesses": {
						label: "Related Businesses",
						component: RelatedBusinessesTab,
						props: { businessId } satisfies Omit<
							RelatedBusinessesTabProps,
							"caseId"
						>,
						hidden: !hasRelatedBusinesses,
					},
					"match-pro": {
						label: "Match Pro",
						component: MatchProTab,
						props: {} satisfies Omit<MatchProTabProps, "caseId">,
						hidden: !isMatchProActive,
					},
				},
				badge: null,
			},
			kyc: {
				label: "KYC",
				component: KycTab,
				props: {} satisfies Omit<KycTabProps, "caseId">,
				subTabs: {},
				badge: null,
			},
			"public-records": {
				label: "Public Records",
				component: null,
				props: {},
				subTabs: {
					"google-profile": {
						label: "Google Profile",
						component: GoogleProfileTab,
						props: {} satisfies Omit<
							GoogleProfileTabProps,
							"caseId"
						>,
					},
					"brand-management": {
						label: "Brand Management",
						component: BrandManagementTab,
						props: {} satisfies Omit<
							BrandManagementTabProps,
							"caseId"
						>,
					},
					"public-filings": {
						label: "Public Filings",
						component: PublicFilingsTab,
						props: {} satisfies Omit<
							PublicFilingsTabProps,
							"caseId"
						>,
					},
					"adverse-media": {
						label: "Adverse Media",
						component: AdverseMediaTab,
						props: {} satisfies Omit<
							AdverseMediaTabProps,
							"caseId"
						>,
					},
				},
				badge: null,
			},
			banking: {
				label: "Banking",
				badge: null,
				component: null,
				subTabs: {
					accounts: {
						label: "Accounts",
						component: AccountsTab,
						props: {},
					},
					trends: {
						label: "Trends",
						component: TrendsTab,
						props: {
							// TODO: data and direction still needed from product team
							deposits: {
								months: {},
								accounts: [],
							},
							spending: {
								categories: [],
								periodDays: 0,
								accounts: [],
							},
						} satisfies Omit<TrendsTabProps, "caseId">,
						hidden: true,
					},
					transactions: {
						label: "Transactions",
						component: TransactionsTab,
						props: {},
					},
					statements: {
						label: "Statements",
						component: StatementsTab,
						props: {} satisfies Omit<StatementsTabProps, "caseId">,
					},
					"trade-lines": {
						label: "Trade Lines",
						component: TradeLinesTab,
						props: {
							// TODO: data and direction still needed from product team
							tradeLineStats: {
								nonFinancialAccounts: [],
								balances: [],
								creditLimits: [],
								satisfactoryAccounts: [],
							},
						} satisfies Omit<TradeLinesTabProps, "caseId">,
						hidden: true,
					},
					"processing-history": {
						label: "Processing History",
						component: ProcessingHistoryTab,
						props: {},
					},
				},
			},
			accounting: {
				label: "Accounting",
				badge: null,
				component: null,
				subTabs: {
					"income-statement": {
						label: "Income Statement",
						component: CaseAccountingIncomeStatementTab,
						props: {},
					},
					"balance-sheet": {
						label: "Balance Sheet",
						component: CaseAccountingBalanceSheetTab,
						props: {},
					},
					uploads: {
						label: "Uploads",
						component: CaseAccountingUploadTab,
						props: {},
					},
				},
			},
			taxes: {
				label: "Taxes",
				component: null,
				props: {},
				subTabs: {
					"business-taxes": {
						label: "Business Taxes",
						component: BusinessTaxesTab,
						props: {},
					},
				},
				badge: null,
			},
			"custom-fields": {
				label: "Custom Fields",
				component: CustomFieldsTab,
				props: {},
				subTabs: {},
				badge: null,
				hidden: !hasCustomFields,
			},
			processors: {
				label: "Processor Integrations",
				component: ProcessorsTab,
				props: {},
				subTabs: {},
				badge: null,
				hidden: !hasProcessorFields,
			},
			documents: {
				label: "Documents",
				component: CaseDocumentsTab,
				props: {},
				subTabs: {},
				badge: null,
			},
		};

		// Build a new config object, only including non-hidden items
		const filteredTabsConfig: Record<string, TabConfig> = {};

		for (const [tabKey, tabConfig] of Object.entries(tabsConfig)) {
			if (!tabConfig.hidden) {
				const filteredSubTabs: Record<string, SubTabConfig> = {};

				for (const [subTabKey, subTabConfig] of Object.entries(
					tabConfig.subTabs,
				)) {
					if (!subTabConfig.hidden) {
						filteredSubTabs[subTabKey] = subTabConfig;
					}
				}

				filteredTabsConfig[tabKey] = {
					...tabConfig,
					subTabs: filteredSubTabs,
				};
			}
		}

		return {
			tabsConfig: filteredTabsConfig,
			defaultMainTab: DEFAULT_MAIN_TAB,
			defaultSubTabs: DEFAULT_SUB_TABS,
		};
	}, [
		hasCustomFields,
		hasProcessorFields,
		hasRelatedBusinesses,
		businessId,
		isMatchProActive,
		sosIntegration?.integrationStatus,
		sosIntegration?.isPending,
	]);
};
