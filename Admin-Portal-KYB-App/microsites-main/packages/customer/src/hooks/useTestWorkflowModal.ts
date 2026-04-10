import { useCallback, useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import { useCustomToast } from "@/hooks";
import {
	useSearchBusinesses,
	useTestWorkflow,
} from "@/services/queries/test-workflow.query";
import type {
	BusinessSearchResult,
	SelectedBusiness,
	TestWorkflowModalStep,
	WorkflowTestResult,
} from "@/types/test-workflow";

import { TEST_WORKFLOW } from "@/constants/TestWorkflow";

interface UseTestWorkflowModalProps {
	customerId: string;
	workflowId?: string;
	isOpen: boolean;
	onClose: () => void;
}

interface UseTestWorkflowModalReturn {
	step: TestWorkflowModalStep;
	searchQuery: string;
	selectedBusinesses: SelectedBusiness[];
	testResults: WorkflowTestResult[];
	currentResultIndex: number;
	isDropdownOpen: boolean;
	searchResults: BusinessSearchResult[];
	isSearching: boolean;
	isCalculating: boolean;
	handleSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
	handleAddBusiness: (business: BusinessSearchResult) => void;
	handleRemoveBusiness: (businessId: string) => void;
	handleCalculateScores: () => Promise<void>;
	handleAddMoreBusinesses: () => void;
	handleClose: () => void;
	handlePreviousResult: () => void;
	handleNextResult: () => void;
	handleFocusSearch: () => void;
	handleBlurSearch: () => void;
}

const DROPDOWN_CLOSE_DELAY_MS = 200;

function createBusinessNameMap(
	businesses: SelectedBusiness[],
): Map<string, string> {
	return new Map(businesses.map((b) => [b.business_id, b.name]));
}

function enrichResultsWithBusinessNames(
	results: WorkflowTestResult[],
	businessNameMap: Map<string, string>,
): WorkflowTestResult[] {
	return results.map((result) => ({
		...result,
		business_name:
			businessNameMap.get(result.business_id) ?? result.business_name,
	}));
}

export const useTestWorkflowModal = ({
	customerId,
	workflowId,
	isOpen,
	onClose,
}: UseTestWorkflowModalProps): UseTestWorkflowModalReturn => {
	const { errorToast } = useCustomToast();

	const [step, setStep] = useState<TestWorkflowModalStep>("search");
	const [searchQuery, setSearchQuery] = useState("");
	const [debouncedQuery, setDebouncedQuery] = useState("");
	const [selectedBusinesses, setSelectedBusinesses] = useState<
		SelectedBusiness[]
	>([]);
	const [testResults, setTestResults] = useState<WorkflowTestResult[]>([]);
	const [currentResultIndex, setCurrentResultIndex] = useState(0);
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);

	const { data: searchData, isLoading: isSearching } = useSearchBusinesses(
		{ customer_id: customerId, query: debouncedQuery },
		isOpen && isDropdownOpen,
	);
	const { mutateAsync: runTest, isPending: isCalculating } = useTestWorkflow();

	const debouncedSearch = useDebouncedCallback((value: string) => {
		setDebouncedQuery(value);
	}, TEST_WORKFLOW.SEARCH_DEBOUNCE_MS);

	const handleSearchChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const value = e.target.value;
			setSearchQuery(value);
			debouncedSearch(value);
			setIsDropdownOpen(true);
		},
		[debouncedSearch],
	);

	const handleAddBusiness = useCallback(
		(business: BusinessSearchResult) => {
			if (selectedBusinesses.length >= TEST_WORKFLOW.MAX_BUSINESSES) {
				return;
			}
			setSelectedBusinesses((prev) => [
				...prev,
				{
					id: business.id,
					business_id: business.business_id,
					name: business.name,
					location: business.location,
					case_id: business.case_id,
				},
			]);
			setSearchQuery("");
			setDebouncedQuery("");
			setIsDropdownOpen(false);
		},
		[selectedBusinesses.length],
	);

	const handleRemoveBusiness = useCallback((businessId: string) => {
		setSelectedBusinesses((prev) => prev.filter((b) => b.id !== businessId));
	}, []);

	const handleCalculateScores = useCallback(async () => {
		if (selectedBusinesses.length === 0) {
			return;
		}

		try {
			const businessNameMap = createBusinessNameMap(selectedBusinesses);

			const response = await runTest({
				request: {
					workflow_id: workflowId,
					business_ids: selectedBusinesses.map((b) => b.business_id),
				},
				options: {
					businessNames: businessNameMap,
				},
			});

			const enrichedResults = enrichResultsWithBusinessNames(
				response.data.results,
				businessNameMap,
			);

			setTestResults(enrichedResults);
			setCurrentResultIndex(0);
			setStep("results");
		} catch (error) {
			errorToast(error);
		}
	}, [selectedBusinesses, workflowId, runTest, errorToast]);

	const handleAddMoreBusinesses = useCallback(() => {
		setStep("search");
	}, []);

	const resetModalState = useCallback(() => {
		setStep("search");
		setSearchQuery("");
		setDebouncedQuery("");
		setSelectedBusinesses([]);
		setTestResults([]);
		setCurrentResultIndex(0);
		setIsDropdownOpen(false);
	}, []);

	const handleClose = useCallback(() => {
		resetModalState();
		onClose();
	}, [onClose, resetModalState]);

	const handlePreviousResult = useCallback(() => {
		if (currentResultIndex > 0) {
			setCurrentResultIndex(currentResultIndex - 1);
		}
	}, [currentResultIndex]);

	const handleNextResult = useCallback(() => {
		if (currentResultIndex < testResults.length - 1) {
			setCurrentResultIndex(currentResultIndex + 1);
		}
	}, [currentResultIndex, testResults.length]);

	const handleFocusSearch = useCallback(() => {
		setIsDropdownOpen(true);
	}, []);

	const handleBlurSearch = useCallback(() => {
		setTimeout(() => {
			setIsDropdownOpen(false);
		}, DROPDOWN_CLOSE_DELAY_MS);
	}, []);

	const searchResults = searchData?.data?.records ?? [];

	return {
		step,
		searchQuery,
		selectedBusinesses,
		testResults,
		currentResultIndex,
		isDropdownOpen,
		searchResults,
		isSearching,
		isCalculating,
		handleSearchChange,
		handleAddBusiness,
		handleRemoveBusiness,
		handleCalculateScores,
		handleAddMoreBusinesses,
		handleClose,
		handlePreviousResult,
		handleNextResult,
		handleFocusSearch,
		handleBlurSearch,
	};
};
