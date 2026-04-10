import React from "react";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { useTestWorkflowModal } from "@/hooks/useTestWorkflowModal";
import { BusinessSearchDropdown } from "./BusinessSearchDropdown";
import { SelectedBusinessesList } from "./SelectedBusinessesList";
import { TestResultsView } from "./TestResultsView";

import { TEST_WORKFLOW } from "@/constants/TestWorkflow";
import { Button } from "@/ui/button";
import {
	Modal,
	ModalBody,
	ModalContent,
	ModalFooter,
	ModalHeader,
} from "@/ui/modal";

interface TestWorkflowModalProps {
	isOpen: boolean;
	onClose: () => void;
	customerId: string;
	workflowId?: string;
}

export const TestWorkflowModal: React.FC<TestWorkflowModalProps> = ({
	isOpen,
	onClose,
	customerId,
	workflowId,
}) => {
	const {
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
	} = useTestWorkflowModal({
		customerId,
		workflowId,
		isOpen,
		onClose,
	});

	const isMaxBusinessesSelected =
		selectedBusinesses.length >= TEST_WORKFLOW.MAX_BUSINESSES;
	const shouldShowDropdown =
		isDropdownOpen &&
		!isMaxBusinessesSelected &&
		(searchResults.length > 0 || isSearching);
	const isCalculateDisabled = selectedBusinesses.length === 0 || isCalculating;

	const renderSearchStep = () => (
		<div className="flex flex-col">
			<div className="relative">
				<div className="border border-gray-200 rounded-lg">
					<div className="relative flex items-center">
						<input
							type="text"
							value={searchQuery}
							onChange={handleSearchChange}
							onFocus={handleFocusSearch}
							onBlur={handleBlurSearch}
							placeholder="Search by business name, business id, or case id"
							className="w-full h-12 pl-4 pr-12 text-sm text-gray-800 border-0 focus:outline-none focus:ring-0 rounded-lg"
						/>
						<MagnifyingGlassIcon className="absolute right-4 h-5 w-5 text-gray-400 pointer-events-none" />
					</div>
				</div>

				{shouldShowDropdown && (
					<div className="absolute left-0 right-0 top-full z-10 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
						<BusinessSearchDropdown
							results={searchResults}
							selectedBusinesses={selectedBusinesses}
							isLoading={isSearching}
							onAddBusiness={handleAddBusiness}
							maxSelections={TEST_WORKFLOW.MAX_BUSINESSES}
						/>
					</div>
				)}
			</div>

			<SelectedBusinessesList
				businesses={selectedBusinesses}
				onRemoveBusiness={handleRemoveBusiness}
				maxSelections={TEST_WORKFLOW.MAX_BUSINESSES}
			/>
		</div>
	);

	const renderSearchFooter = () => (
		<>
			<Button
				variant="outline"
				onClick={handleClose}
				className="bg-white text-gray-700 border-gray-200 hover:bg-gray-50 px-6 h-10"
			>
				Cancel
			</Button>
			<Button
				onClick={handleCalculateScores}
				disabled={isCalculateDisabled}
				className="bg-blue-600 hover:bg-blue-700 text-white px-6 h-10"
			>
				{isCalculating ? "Calculating..." : "Calculate Scores"}
			</Button>
		</>
	);

	const renderResultsFooter = () => (
		<>
			<Button
				variant="outline"
				onClick={handleClose}
				className="bg-white text-gray-700 border-gray-200 hover:bg-gray-50 px-6 h-10"
			>
				Cancel
			</Button>
			<Button
				variant="outline"
				onClick={handleAddMoreBusinesses}
				className="bg-white text-gray-700 border-gray-200 hover:bg-gray-50 px-6 h-10"
			>
				Add More Businesses
			</Button>
			<Button
				onClick={handleClose}
				className="bg-blue-600 hover:bg-blue-700 text-white px-6 h-10"
			>
				Done
			</Button>
		</>
	);

	return (
		<Modal
			open={isOpen}
			onOpenChange={(open) => {
				if (!open) handleClose();
			}}
		>
			<ModalContent
				className="p-0 gap-0 flex flex-col"
				style={{
					width: "900px",
					maxWidth: "90vw",
					height: "800px",
					maxHeight: "90vh",
					top: "50%",
				}}
			>
				<ModalHeader
					onClose={handleClose}
					className="border-b border-gray-200 flex-shrink-0 px-8 py-6"
					description="Test your workflow to check if the outcome is what you have planned for."
					title={<span className="text-2xl font-bold">Test Workflows</span>}
					subtitle={
						<p className="text-sm text-gray-500">
							Test your workflow to check if the outcome is what you have
							planned for.
						</p>
					}
				/>

				<ModalBody className="px-8 py-10 flex-1 overflow-y-auto">
					{step === "search" && renderSearchStep()}

					{step === "results" && (
						<TestResultsView
							results={testResults}
							currentIndex={currentResultIndex}
							onPrevious={handlePreviousResult}
							onNext={handleNextResult}
						/>
					)}
				</ModalBody>

				<ModalFooter className="px-8 py-4 border-t border-gray-200 flex-shrink-0">
					{step === "search" && renderSearchFooter()}
					{step === "results" && renderResultsFooter()}
				</ModalFooter>
			</ModalContent>
		</Modal>
	);
};
