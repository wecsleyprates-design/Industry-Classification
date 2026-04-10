import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
	ArrowDownTrayIcon,
	ArrowLeftIcon,
	ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import axios from "axios";
import Button from "@/components/Button";
import { WorkflowModal } from "@/components/Modal";
import { useCustomToast } from "@/hooks";
import { useURLParams } from "@/hooks/useURLParams";
import { useWorkflowPermissions } from "@/hooks/useWorkflowPermissions";
import { downloadBlobAsFile, extractFilenameFromHeader } from "@/lib/utils";
import {
	useDeleteWorkflow,
	useExportExecutionLogs,
	useGetWorkflows,
	useUpdateWorkflowStatus,
} from "@/services/queries/workflows.query";
import type { GetWorkflowsParams, Workflow } from "@/types/workflows";
import WorkflowsEmptyState from "./WorkflowsEmptyState";
import WorkflowsFilters, {
	type WorkflowFilters,
	WorkflowsNoResultsState,
} from "./WorkflowsFilters";
import WorkflowsTable from "./WorkflowsTable";

import { PLATFORM, type PlatformType } from "@/constants/Platform";
import { Pagination } from "@/ui/Pagination";
import { PaginationDescription } from "@/ui/PaginationDescription";

interface WorkflowsDashboardProps {
	customerId: string;
	platform?: PlatformType;
}

const ITEMS_PER_PAGE = 10;

const WorkflowsDashboard: React.FC<WorkflowsDashboardProps> = ({
	customerId,
	platform = PLATFORM.customer,
}) => {
	const navigate = useNavigate();
	const { updateParams } = useURLParams();
	const { successToast, errorToast } = useCustomToast();
	const { canWrite } = useWorkflowPermissions();
	const [currentPage, setCurrentPage] = useState<number>(1);
	const [filters, setFilters] = useState<WorkflowFilters>({});
	const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
	const [workflowToDelete, setWorkflowToDelete] = useState<Workflow | null>(
		null,
	);
	const [isDeleting, setIsDeleting] = useState(false);
	const [isActivationErrorModalOpen, setIsActivationErrorModalOpen] =
		useState(false);
	const [activationErrorMessage, setActivationErrorMessage] = useState<
		string | null
	>(null);

	const { mutateAsync: deleteWorkflow } = useDeleteWorkflow();
	const { mutateAsync: updateWorkflowStatus } = useUpdateWorkflowStatus();
	const { mutateAsync: exportLogs, isPending: isExporting } =
		useExportExecutionLogs();

	const queryParams: GetWorkflowsParams = useMemo(
		() => ({
			customer_id: customerId,
			page: currentPage,
			items_per_page: ITEMS_PER_PAGE,
			pagination: true,
			filter: filters.status?.length ? { status: filters.status } : undefined,
		}),
		[customerId, currentPage, filters],
	);

	const { data: workflowsData, isLoading } = useGetWorkflows(queryParams);

	const workflows = workflowsData?.data?.records ?? [];
	const totalPages = workflowsData?.data?.total_pages ?? 0;
	const hasActiveFilters = !!filters.status && filters.status.length > 0;
	const hasNoResults = !isLoading && workflows.length === 0 && hasActiveFilters;
	const isEmpty = !isLoading && workflows.length === 0 && !hasActiveFilters;

	const handleFilterChange = (newFilters: WorkflowFilters) => {
		setFilters(newFilters);
		setCurrentPage(1); // Reset to first page when filters change
	};

	const handleClearFilters = () => {
		setFilters({});
		setCurrentPage(1);
	};

	const handleCreateWorkflow = () => {
		updateParams({ mode: "create" });
	};

	const handleExportAllLogs = async () => {
		try {
			const response = await exportLogs({ customerId });
			const filename = extractFilenameFromHeader(
				response.filename,
				"execution_logs",
			);
			downloadBlobAsFile(response.data, filename);
			successToast("Execution logs exported successfully");
		} catch (error) {
			errorToast(error);
		}
	};

	const handleEditWorkflow = (workflowId: string) => {
		const wizardMode = canWrite ? "edit" : "view";
		updateParams({ mode: wizardMode, workflowId });
	};

	const handleToggleStatus = async (workflowId: string, status: boolean) => {
		try {
			await updateWorkflowStatus({
				workflowId,
				status,
			});
			successToast(
				status
					? "Workflow activated successfully"
					: "Workflow deactivated successfully",
			);
		} catch (error) {
			if (
				axios.isAxiosError(error) &&
				error.response?.status === 409 &&
				status
			) {
				// Workflow doesn't have a published version (only when activating)
				const errorMessage =
					error.response?.data?.message ??
					"You need to complete the pending configuration before activating the workflow";
				setActivationErrorMessage(errorMessage);
				setIsActivationErrorModalOpen(true);
			} else {
				errorToast(error);
			}
		}
	};

	const handleDeleteWorkflow = (workflow: Workflow) => {
		setWorkflowToDelete(workflow);
		setIsDeleteModalOpen(true);
	};

	const confirmDeleteWorkflow = async () => {
		if (!workflowToDelete) return;

		setIsDeleting(true);
		try {
			await deleteWorkflow(workflowToDelete.id);
			successToast("Workflow deleted successfully.");
		} catch (error) {
			errorToast(error);
			throw error;
		} finally {
			setIsDeleting(false);
		}
	};

	const handlePageChange = (page: number) => {
		setCurrentPage(page);
		// Scroll to top when page changes
		window.scrollTo({ top: 0, behavior: "smooth" });
	};

	const handleBack = () => {
		const params = new URLSearchParams();
		params.set("subtab", "decisioning");

		let parentUrl: string;

		if (platform === PLATFORM.customer) {
			// Customer-admin-webapp uses nested routes: /settings/scoring
			parentUrl = `/settings/scoring?${params.toString()}`;
		} else {
			// Worth-admin-webapp uses query params: /customers/:slug/edit?tab=risk-monitoring
			params.set("tab", "risk-monitoring");
			parentUrl = `/customers/${customerId}/edit?${params.toString()}`;
		}

		navigate(parentUrl);
	};

	return (
		<div className="p-5 sm:pr-5">
			{/* Header with back button */}
			<div className="flex items-center gap-3 mb-6">
				<button
					type="button"
					onClick={handleBack}
					className="p-1 text-gray-600 hover:text-gray-900 transition-colors"
					aria-label="Go back"
				>
					<ArrowLeftIcon className="w-5 h-5" />
				</button>
				<h1 className="text-xl font-semibold text-[#1F2937]">
					Custom Workflows
				</h1>
			</div>

			{/* Main content card */}
			<div className="bg-white border border-gray-200 rounded-xl p-6">
				{/* Section header with title, description, and actions */}
				<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
					<div>
						<h2 className="text-lg font-semibold text-[#1F2937] mb-1">
							Workflows
						</h2>
						<p className="text-sm text-[#6B7280]">
							Create workflows that approve, decline, or route.
						</p>
					</div>
					<div className="flex items-center gap-3">
						<WorkflowsFilters
							onFilterChange={handleFilterChange}
							onClearFilters={handleClearFilters}
							hasActiveFilters={hasActiveFilters}
						/>
						<Button
							type="button"
							color="white"
							onClick={handleExportAllLogs}
							disabled={isExporting}
							className="h-10 px-4 flex items-center gap-2 rounded-lg font-semibold text-sm"
						>
							<ArrowDownTrayIcon className="w-4 h-4" />
							{isExporting ? "Exporting..." : "Export Logs"}
						</Button>
						<Button
							type="button"
							color="blue"
							onClick={handleCreateWorkflow}
							disabled={!canWrite}
							className="h-10 px-5 rounded-lg font-semibold text-sm"
						>
							Create Workflow
						</Button>
					</div>
				</div>

				{/* Content area */}
				{isEmpty ? (
					<WorkflowsEmptyState
						onCreateWorkflow={handleCreateWorkflow}
						isReadOnly={!canWrite}
					/>
				) : hasNoResults ? (
					<WorkflowsNoResultsState onClearFilters={handleClearFilters} />
				) : (
					<>
						<WorkflowsTable
							workflows={workflows}
							customerId={customerId}
							isLoading={isLoading}
							onEditWorkflow={handleEditWorkflow}
							onToggleStatus={handleToggleStatus}
							onDeleteWorkflow={handleDeleteWorkflow}
						/>

						{/* Pagination */}
						{totalPages > 1 && (
							<div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
								<PaginationDescription
									data={workflowsData}
									currentPage={currentPage}
									itemsPerPage={ITEMS_PER_PAGE}
								/>
								<Pagination
									currentPage={currentPage}
									totalPages={totalPages}
									onPageChange={handlePageChange}
								/>
							</div>
						)}
					</>
				)}
			</div>

			{/* Delete Confirmation Modal */}
			<WorkflowModal
				isOpen={isDeleteModalOpen}
				onClose={() => {
					setIsDeleteModalOpen(false);
					setWorkflowToDelete(null);
				}}
				onSucess={confirmDeleteWorkflow}
				title="Delete Workflow"
				description={
					<div>
						<p className="mb-4">
							Are you absolutely sure you want to delete this workflow?
						</p>
						<div className="p-3 bg-red-50 border border-red-200 rounded-md">
							<div className="flex items-start gap-2">
								<ExclamationTriangleIcon className="w-5 h-5 text-red-600" />
								<p className="flex-1 text-sm text-red-800">
									This action cannot be undone. This will permanently delete the
									workflow named "{workflowToDelete?.name}" and all of its
									associated data.
								</p>
							</div>
						</div>
					</div>
				}
				buttonText="Delete"
				isLoading={isDeleting}
			/>

			{/* Activation Error Modal (409 Conflict) */}
			<WorkflowModal
				isOpen={isActivationErrorModalOpen}
				onClose={() => {
					setIsActivationErrorModalOpen(false);
					setActivationErrorMessage(null);
				}}
				onSucess={() => {
					setIsActivationErrorModalOpen(false);
					setActivationErrorMessage(null);
				}}
				title="Cannot Activate Workflow"
				description={
					<div>
						<p className="mb-4">{activationErrorMessage}</p>
						<div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
							<div className="flex items-start gap-2">
								<ExclamationTriangleIcon className="w-5 h-5 text-yellow-600" />
								<p className="flex-1 text-sm text-yellow-800">
									Please complete the workflow configuration and publish a
									version before activating it.
								</p>
							</div>
						</div>
					</div>
				}
				buttonText="OK"
				showCancel={false}
			/>
		</div>
	);
};

export default WorkflowsDashboard;
