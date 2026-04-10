import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { useGetRelatedBusinesses } from "@/services/queries/businesses.query";
import { type CaseData } from "@/types/case";
import { useTabsConfig } from "../useTabsConfig";

// Mock all tab components to avoid import issues
jest.mock("@/page/Cases/CaseDetails/Tabs/Accounting", () => ({
	CaseAccountingBalanceSheetTab: () => null,
	CaseAccountingIncomeStatementTab: () => null,
	CaseAccountingUploadTab: () => null,
}));

jest.mock("@/page/Cases/CaseDetails/Tabs/Banking", () => ({
	AccountsTab: () => null,
	ProcessingHistoryTab: () => null,
	StatementsTab: () => null,
	TradeLinesTab: () => null,
	TransactionsTab: () => null,
	TrendsTab: () => null,
}));

jest.mock("@/page/Cases/CaseDetails/Tabs/case-documents-tab", () => ({
	CaseDocumentsTab: () => null,
}));

jest.mock("@/page/Cases/CaseDetails/Tabs/CustomFields", () => ({
	CustomFieldsTab: () => null,
}));

jest.mock("@/page/Cases/CaseDetails/Tabs/GoogleProfileTab", () => ({
	GoogleProfileTab: () => null,
}));

jest.mock("@/page/Cases/CaseDetails/Tabs/KYB", () => ({
	BackgroundTab: () => null,
	BusinessRegistrationTab: () => null,
	ContactInformationTab: () => null,
	RelatedBusinessesTab: () => null,
	WatchlistsTab: () => null,
	WebsiteTab: () => null,
}));

jest.mock("@/page/Cases/CaseDetails/Tabs/KYC", () => ({
	KycTab: () => null,
}));

jest.mock("@/page/Cases/CaseDetails/Tabs/Taxes", () => ({
	BusinessTaxesTab: () => null,
}));

jest.mock("@/page/Cases/CaseDetails/Tabs/case-details-overview-tab", () => ({
	CaseDetailsOverviewTab: () => null,
}));

jest.mock("@/page/Cases/CaseDetails/Tabs/PublicRecords", () => ({
	AdverseMediaTab: () => null,
	BrandManagementTab: () => null,
	PublicFilingsTab: () => null,
}));

// Mock the related businesses query
jest.mock("@/services/queries/businesses.query", () => ({
	useGetRelatedBusinesses: jest.fn(),
}));

const mockUseGetRelatedBusinesses =
	useGetRelatedBusinesses as jest.MockedFunction<
		typeof useGetRelatedBusinesses
	>;

// Create a wrapper component for React Query
const createWrapper = () => {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
			},
		},
	});

	// eslint-disable-next-line react/display-name
	return ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={queryClient}>
			{children}
		</QueryClientProvider>
	);
};

// Mock case data factory
const createMockCaseData = (
	overrides: Partial<CaseData> = {},
): Pick<CaseData, "customer_id" | "business_id" | "custom_fields"> => ({
	customer_id: "test-customer-id",
	business_id: "test-business-id",
	custom_fields: [],
	...overrides,
});

describe("useTabsConfig", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	const createMockGetRelatedBusinessesResponse = (totalItems = 0) =>
		({
			data: {
				data: { total_items: totalItems },
			},
		}) as ReturnType<typeof useGetRelatedBusinesses>;

	describe("Basic functionality", () => {
		it("should return correct structure with default values", () => {
			mockUseGetRelatedBusinesses.mockReturnValue(
				createMockGetRelatedBusinessesResponse(),
			);

			const { result } = renderHook(() => useTabsConfig(), {
				wrapper: createWrapper(),
			});

			expect(result.current).toHaveProperty("tabsConfig");
			expect(result.current).toHaveProperty("defaultMainTab");
			expect(result.current).toHaveProperty("defaultSubTabs");

			expect(result.current.defaultMainTab).toBe("overview");
			expect(result.current.defaultSubTabs).toEqual({
				kyb: "background",
				"public-records": "google-profile",
				banking: "accounts",
				accounting: "income-statement",
				taxes: "business-taxes",
			});
		});

		it("should include all main tabs when no data filtering is needed", () => {
			mockUseGetRelatedBusinesses.mockReturnValue(
				createMockGetRelatedBusinessesResponse(),
			);

			const caseData = createMockCaseData({
				custom_fields: [
					{
						id: "field-1",
						label: "Test Field",
						is_sensitive: false,
						internalName: "test_field",
						property: "text",
						step_name: "test_step",
						sequence_number: 1,
						value: "test value",
					},
				],
			});

			const { result } = renderHook(() => useTabsConfig(caseData), {
				wrapper: createWrapper(),
			});

			const tabKeys = Object.keys(result.current.tabsConfig);
			expect(tabKeys).toContain("overview");
			expect(tabKeys).toContain("kyb");
			expect(tabKeys).toContain("kyc");
			expect(tabKeys).toContain("public-records");
			expect(tabKeys).toContain("banking");
			expect(tabKeys).toContain("accounting");
			expect(tabKeys).toContain("taxes");
			expect(tabKeys).toContain("custom-fields");
			expect(tabKeys).toContain("documents");
		});
	});

	describe("Custom fields visibility", () => {
		it("should hide custom-fields tab when no custom fields exist", () => {
			mockUseGetRelatedBusinesses.mockReturnValue(
				createMockGetRelatedBusinessesResponse(),
			);

			const caseData = createMockCaseData();

			const { result } = renderHook(() => useTabsConfig(caseData), {
				wrapper: createWrapper(),
			});

			expect(result.current.tabsConfig).not.toHaveProperty(
				"custom-fields",
			);
		});

		it("should hide custom-fields tab when custom_fields is undefined", () => {
			mockUseGetRelatedBusinesses.mockReturnValue(
				createMockGetRelatedBusinessesResponse(),
			);

			const caseData = createMockCaseData({
				custom_fields: undefined,
			});

			const { result } = renderHook(() => useTabsConfig(caseData), {
				wrapper: createWrapper(),
			});

			expect(result.current.tabsConfig).not.toHaveProperty(
				"custom-fields",
			);
		});

		it("should show custom-fields tab when custom fields exist", () => {
			mockUseGetRelatedBusinesses.mockReturnValue(
				createMockGetRelatedBusinessesResponse(),
			);

			const caseData = createMockCaseData({
				custom_fields: [
					{
						id: "field-1",
						label: "Test Field",
						is_sensitive: false,
						internalName: "test_field",
						property: "text",
						step_name: "test_step",
						sequence_number: 1,
						value: "test value",
					},
				],
			});

			const { result } = renderHook(() => useTabsConfig(caseData), {
				wrapper: createWrapper(),
			});

			expect(result.current.tabsConfig).toHaveProperty("custom-fields");
			expect(result.current.tabsConfig["custom-fields"].hidden).toBe(
				false,
			);
		});
	});

	describe("Related businesses visibility", () => {
		it("should hide related-businesses subtab when no related businesses exist", () => {
			mockUseGetRelatedBusinesses.mockReturnValue(
				createMockGetRelatedBusinessesResponse(),
			);

			const caseData = createMockCaseData();

			const { result } = renderHook(() => useTabsConfig(caseData), {
				wrapper: createWrapper(),
			});

			const kybSubTabs = result.current.tabsConfig.kyb.subTabs;
			expect(kybSubTabs).not.toHaveProperty("related-businesses");
		});

		it("should show related-businesses subtab when related businesses exist", () => {
			mockUseGetRelatedBusinesses.mockReturnValue(
				createMockGetRelatedBusinessesResponse(5),
			);

			const caseData = createMockCaseData();

			const { result } = renderHook(() => useTabsConfig(caseData), {
				wrapper: createWrapper(),
			});

			const kybSubTabs = result.current.tabsConfig.kyb.subTabs;
			expect(kybSubTabs).toHaveProperty("related-businesses");
			expect(kybSubTabs["related-businesses"].hidden).toBe(false);
		});

		it("should call useGetRelatedBusinesses with correct parameters", () => {
			const caseData = createMockCaseData({
				customer_id: "customer-123",
				business_id: "business-456",
			});

			renderHook(() => useTabsConfig(caseData), {
				wrapper: createWrapper(),
			});

			expect(mockUseGetRelatedBusinesses).toHaveBeenCalledWith(
				"customer-123",
				"business-456",
			);
		});
	});

	describe("Hidden subtabs", () => {
		it("should filter out hidden subtabs from configuration", () => {
			mockUseGetRelatedBusinesses.mockReturnValue(
				createMockGetRelatedBusinessesResponse(),
			);

			const caseData = createMockCaseData();

			const { result } = renderHook(() => useTabsConfig(caseData), {
				wrapper: createWrapper(),
			});

			// Check that trends and trade-lines subtabs are hidden and filtered out
			const bankingSubTabs = result.current.tabsConfig.banking.subTabs;
			expect(bankingSubTabs).not.toHaveProperty("trends");
			expect(bankingSubTabs).not.toHaveProperty("trade-lines");

			// But visible subtabs should be present
			expect(bankingSubTabs).toHaveProperty("accounts");
			expect(bankingSubTabs).toHaveProperty("transactions");
			expect(bankingSubTabs).toHaveProperty("statements");
			expect(bankingSubTabs).toHaveProperty("processing-history");
		});
	});

	describe("Tab component and props", () => {
		it("should have correct component assignments for main tabs", () => {
			mockUseGetRelatedBusinesses.mockReturnValue(
				createMockGetRelatedBusinessesResponse(),
			);

			const caseData = createMockCaseData({
				custom_fields: [
					{
						id: "field-1",
						label: "Test Field",
						is_sensitive: false,
						internalName: "test_field",
						property: "text",
						step_name: "test_step",
						sequence_number: 1,
						value: "test value",
					},
				],
			});

			const { result } = renderHook(() => useTabsConfig(caseData), {
				wrapper: createWrapper(),
			});

			const { tabsConfig } = result.current;

			// Tabs with components
			expect(tabsConfig.overview.component).toBeTruthy();
			expect(tabsConfig.kyc.component).toBeTruthy();
			expect(tabsConfig["custom-fields"]?.component).toBeTruthy();
			expect(tabsConfig.documents.component).toBeTruthy();

			// Tabs that are containers (no direct component)
			expect(tabsConfig.kyb.component).toBeNull();
			expect(tabsConfig["public-records"].component).toBeNull();
			expect(tabsConfig.banking.component).toBeNull();
			expect(tabsConfig.accounting.component).toBeNull();
			expect(tabsConfig.taxes.component).toBeNull();
		});

		it("should pass correct props to related businesses subtab", () => {
			mockUseGetRelatedBusinesses.mockReturnValue(
				createMockGetRelatedBusinessesResponse(1),
			);

			const caseData = createMockCaseData({
				business_id: "business-789",
			});

			const { result } = renderHook(() => useTabsConfig(caseData), {
				wrapper: createWrapper(),
			});

			const relatedBusinessesSubTab =
				result.current.tabsConfig.kyb.subTabs["related-businesses"];

			expect(relatedBusinessesSubTab.props).toEqual({
				businessId: "business-789",
			});
		});
	});

	describe("Memoization", () => {
		it("should return same reference when dependencies don't change", () => {
			mockUseGetRelatedBusinesses.mockReturnValue(
				createMockGetRelatedBusinessesResponse(),
			);

			const caseData = createMockCaseData();

			const { result, rerender } = renderHook(
				({ data }) => useTabsConfig(data),
				{
					wrapper: createWrapper(),
					initialProps: { data: caseData },
				},
			);

			const firstResult = result.current;

			rerender({ data: caseData });

			expect(result.current).toBe(firstResult);
		});

		it("should return new reference when custom fields change", () => {
			mockUseGetRelatedBusinesses.mockReturnValue(
				createMockGetRelatedBusinessesResponse(),
			);

			const caseDataWithoutFields = createMockCaseData({
				custom_fields: [],
			});

			const caseDataWithFields = createMockCaseData({
				custom_fields: [
					{
						id: "field-1",
						label: "Test Field",
						is_sensitive: false,
						internalName: "test_field",
						property: "text",
						step_name: "test_step",
						sequence_number: 1,
						value: "test value",
					},
				],
			});

			const { result, rerender } = renderHook(
				({ data }) => useTabsConfig(data),
				{
					wrapper: createWrapper(),
					initialProps: { data: caseDataWithoutFields },
				},
			);

			const firstResult = result.current;

			rerender({ data: caseDataWithFields });

			expect(result.current).not.toBe(firstResult);
		});
	});

	describe("Edge cases", () => {
		it("should handle undefined case data gracefully", () => {
			mockUseGetRelatedBusinesses.mockReturnValue(
				createMockGetRelatedBusinessesResponse(),
			);

			const { result } = renderHook(() => useTabsConfig(undefined), {
				wrapper: createWrapper(),
			});

			expect(result.current.tabsConfig).toBeDefined();
			expect(result.current.tabsConfig).not.toHaveProperty(
				"custom-fields",
			);
		});

		it("should handle empty customer_id and business_id", () => {
			const caseData = createMockCaseData({
				customer_id: "",
				business_id: "",
			});

			renderHook(() => useTabsConfig(caseData), {
				wrapper: createWrapper(),
			});

			expect(mockUseGetRelatedBusinesses).toHaveBeenCalledWith("", "");
		});

		it("should handle missing customer_id and business_id", () => {
			const caseData = createMockCaseData({
				customer_id: undefined,
				business_id: undefined,
			});

			renderHook(() => useTabsConfig(caseData), {
				wrapper: createWrapper(),
			});

			expect(mockUseGetRelatedBusinesses).toHaveBeenCalledWith("", "");
		});

		it("should handle undefined related businesses response", () => {
			mockUseGetRelatedBusinesses.mockReturnValue({
				data: undefined,
			} as any);

			const caseData = createMockCaseData();

			const { result } = renderHook(() => useTabsConfig(caseData), {
				wrapper: createWrapper(),
			});

			// Should not show related businesses subtab
			const kybSubTabs = result.current.tabsConfig.kyb.subTabs;
			expect(kybSubTabs).not.toHaveProperty("related-businesses");
		});

		it("should handle malformed related businesses response", () => {
			mockUseGetRelatedBusinesses.mockReturnValue({
				data: { data: null },
			} as any);

			const caseData = createMockCaseData();

			const { result } = renderHook(() => useTabsConfig(caseData), {
				wrapper: createWrapper(),
			});

			// Should not show related businesses subtab
			const kybSubTabs = result.current.tabsConfig.kyb.subTabs;
			expect(kybSubTabs).not.toHaveProperty("related-businesses");
		});
	});

	describe("Tab structure validation", () => {
		it("should have correct labels for all tabs", () => {
			mockUseGetRelatedBusinesses.mockReturnValue(
				createMockGetRelatedBusinessesResponse(1),
			);

			const caseData = createMockCaseData({
				custom_fields: [
					{
						id: "field-1",
						label: "Test Field",
						is_sensitive: false,
						internalName: "test_field",
						property: "text",
						step_name: "test_step",
						sequence_number: 1,
						value: "test value",
					},
				],
			});

			const { result } = renderHook(() => useTabsConfig(caseData), {
				wrapper: createWrapper(),
			});

			const { tabsConfig } = result.current;

			expect(tabsConfig.overview.label).toBe("Overview");
			expect(tabsConfig.kyb.label).toBe("KYB");
			expect(tabsConfig.kyc.label).toBe("KYC");
			expect(tabsConfig["public-records"].label).toBe("Public Records");
			expect(tabsConfig.banking.label).toBe("Banking");
			expect(tabsConfig.accounting.label).toBe("Accounting");
			expect(tabsConfig.taxes.label).toBe("Taxes");
			expect(tabsConfig["custom-fields"].label).toBe("Custom Fields");
			expect(tabsConfig.documents.label).toBe("Documents");
		});

		it("should have correct KYB subtab labels", () => {
			mockUseGetRelatedBusinesses.mockReturnValue(
				createMockGetRelatedBusinessesResponse(1),
			);

			const caseData = createMockCaseData();

			const { result } = renderHook(() => useTabsConfig(caseData), {
				wrapper: createWrapper(),
			});

			const kybSubTabs = result.current.tabsConfig.kyb.subTabs;

			expect(kybSubTabs.background.label).toBe("Background");
			expect(kybSubTabs["tax-id-sos"].label).toBe(
				"Business Registration",
			);
			expect(kybSubTabs["business-summary"].label).toBe(
				"Contact Information",
			);
			expect(kybSubTabs["website-review"].label).toBe("Website");
			expect(kybSubTabs.watchlists.label).toBe("Watchlists");
			expect(kybSubTabs["related-businesses"].label).toBe(
				"Related Businesses",
			);
		});

		it("should have all tabs with badge property", () => {
			mockUseGetRelatedBusinesses.mockReturnValue(
				createMockGetRelatedBusinessesResponse(),
			);

			const { result } = renderHook(() => useTabsConfig(), {
				wrapper: createWrapper(),
			});

			const { tabsConfig } = result.current;

			Object.values(tabsConfig).forEach((tab) => {
				expect(tab).toHaveProperty("badge");
			});
		});
	});
});
