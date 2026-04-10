import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
	ClockIcon,
	CursorArrowRaysIcon,
	LightBulbIcon,
	RectangleStackIcon,
	RocketLaunchIcon,
} from "@heroicons/react/24/outline";
import { useQueryClient } from "@tanstack/react-query";
import { twMerge } from "tailwind-merge";
import CustomWorkflowIcon from "@/assets/CustomWorkflowIcon";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import { WorkflowModal } from "@/components/Modal";
import DecisioningSkeleton from "@/components/Skeleton/DecisioningSkeleton";
import { useCustomToast } from "@/hooks";
import { useWorkflowPermissions } from "@/hooks/useWorkflowPermissions";
import {
	useGetDecisioningConfiguration,
	useUpdateDecisioningConfiguration,
} from "@/services/queries/decisioning.query";

import { PLATFORM } from "@/constants/Platform";

interface Props {
	customerId: string;
	platform?: "admin" | "customer";
	onNavigateToScoring?: () => void;
}

const DecisioningSelection: React.FC<Props> = ({
	customerId,
	platform = "admin",
	onNavigateToScoring,
}) => {
	const navigate = useNavigate();
	const [showEnableCustomWorkflowModal, setShowEnableCustomWorkflowModal] =
		useState(false);
	const [showSwitchToWorthScoreModal, setShowSwitchToWorthScoreModal] =
		useState(false);
	const [pendingSuccessMessage, setPendingSuccessMessage] = useState<
		string | null
	>(null);
	const { successToast, errorToast } = useCustomToast();
	const queryClient = useQueryClient();
	const { canWrite } = useWorkflowPermissions();

	// Fetch active decisioning configuration from backend
	const {
		data: decisioningConfig,
		error: decisioningConfigError,
		isLoading: isDecisioningConfigLoading,
	} = useGetDecisioningConfiguration(customerId);

	const {
		mutateAsync: updateDecisioningConfig,
		error: updateDecisioningError,
	} = useUpdateDecisioningConfiguration();

	// Determine active state from backend configuration
	// Backend returns "worth_score" as default if no configuration exists
	const activeDecisioningType =
		decisioningConfig?.data?.active_decisioning_type ?? "worth_score";
	const isWorthScoreActive = activeDecisioningType === "worth_score";
	const isCustomWorkflowActive = activeDecisioningType === "custom_workflow";

	// Handle errors from queries
	useEffect(() => {
		if (decisioningConfigError) {
			errorToast(decisioningConfigError);
		}
	}, [decisioningConfigError, errorToast]);

	useEffect(() => {
		if (updateDecisioningError) {
			errorToast(updateDecisioningError);
		}
	}, [updateDecisioningError, errorToast]);

	// Show success toast when modal is closed
	useEffect(() => {
		if (
			!showEnableCustomWorkflowModal &&
			!showSwitchToWorthScoreModal &&
			pendingSuccessMessage
		) {
			successToast(pendingSuccessMessage);
			setPendingSuccessMessage(null);
		}
	}, [
		showEnableCustomWorkflowModal,
		showSwitchToWorthScoreModal,
		pendingSuccessMessage,
		successToast,
	]);

	const handleWorthScoreButtonClick = () => {
		// Button always navigates to Scoring tab
		onNavigateToScoring?.();
	};

	const handleCustomWorkflowButtonClick = () => {
		// Platform-specific URL construction:
		let workflowUrl: string;
		if (platform === PLATFORM.customer) {
			workflowUrl = "/settings/workflows";
		} else {
			workflowUrl = `/customers/${customerId}/workflows`;
		}

		try {
			navigate(workflowUrl);
		} catch (error) {
			// Fallback to window.location if navigate fails (e.g., in production build issues)
			console.error("Navigation error:", error);
			window.location.href = workflowUrl;
		}
	};

	const handleWorthScoreCardClick = () => {
		// Card click shows modal to change decisioning (only if not already active and user can write)
		if (!isWorthScoreActive && canWrite) {
			setShowSwitchToWorthScoreModal(true);
		}
	};

	const handleCustomWorkflowCardClick = () => {
		// Card click shows modal to change decisioning (only if not already active and user can write)
		if (!isCustomWorkflowActive && canWrite) {
			setShowEnableCustomWorkflowModal(true);
		}
	};

	const handleUpdateDecisioning = async (
		decisioningType: "worth_score" | "custom_workflow",
		successMessage: string,
	) => {
		// Update backend configuration
		const response = await updateDecisioningConfig({
			customer_id: customerId,
			decisioning_type: decisioningType,
		});
		// Update cache immediately for instant UI update
		queryClient.setQueryData(
			["getDecisioningConfiguration", customerId],
			response,
		);
		// Set success message to show toast when modal closes
		setPendingSuccessMessage(successMessage);
	};

	const handleEnableCustomWorkflow = async () => {
		await handleUpdateDecisioning(
			"custom_workflow",
			"Custom Workflows enabled. New onboarding decisions will use your rules.",
		);
		setShowEnableCustomWorkflowModal(false);
	};

	const handleSwitchToWorthScore = async () => {
		await handleUpdateDecisioning(
			"worth_score",
			"Switched to Worth Score. New decisions will use score thresholds.",
		);
		setShowSwitchToWorthScoreModal(false);
	};

	// Helper: Check if card click should be handled (not on button/interactive element)
	const shouldHandleCardClick = useCallback(
		(target: HTMLElement | null): boolean => {
			if (!target) return false;
			const isButton = target.closest("button");
			const isInteractive =
				target.closest("[role='button']") ?? target.closest("a");
			return !isButton && !isInteractive;
		},
		[],
	);

	// Calculate card className based on active state and permissions
	const getCardClassName = (isActive: boolean) => {
		return twMerge(
			"p-6 border rounded-xl bg-white transition-all",
			isActive && "border-[#2563EB] ring-2 ring-blue-100",
			!isActive && canWrite && "border-[#E5E7EB] cursor-pointer",
			!isActive && !canWrite && "border-[#E5E7EB] cursor-default",
		);
	};

	return (
		<div className="pb-3">
			<div className="mb-6">
				<h2 className="text-xl font-semibold text-[#1F2937] mb-2">
					Decisioning
				</h2>
				<p className="text-sm text-[#6B7280] leading-5">
					Choose how onboarding decisions are made. You can switch engines
					anytime; all changes are tracked and require approval.
				</p>
			</div>

			<div className="space-y-4">
				{isDecisioningConfigLoading ? (
					<>
						<DecisioningSkeleton />
						<DecisioningSkeleton />
					</>
				) : (
					<>
						{/* Worth Score Card */}
						<div
							className={getCardClassName(isWorthScoreActive)}
							onClick={(e) => {
								// Only handle card click if user can write and not clicking on interactive elements
								if (
									!canWrite ||
									!shouldHandleCardClick(e.target as HTMLElement)
								) {
									return;
								}
								handleWorthScoreCardClick();
							}}
						>
							<div className="flex items-start justify-between mb-4">
								<div className="flex items-center gap-4 flex-1">
									<div
										className={twMerge(
											"w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 border",
											isWorthScoreActive
												? "bg-worth-purple-light border-worth-purple"
												: "bg-white border-[#E5E7EB]",
										)}
									>
										<img
											src="/worth-logo.svg"
											alt="WorthIt Logo"
											className={twMerge(
												"w-8 h-8 object-contain",
												isWorthScoreActive ? "opacity-100" : "opacity-50",
											)}
										/>
									</div>
									<div className="flex-1">
										<div className="flex items-center gap-2 mb-1">
											<h3 className="text-lg font-semibold text-[#1F2937] leading-6">
												Worth Score
											</h3>
											{isWorthScoreActive && (
												<Badge
													color="green"
													isRemoveable={false}
													text="LIVE"
													className="text-xs"
												/>
											)}
										</div>
										<p className="text-sm text-[#6B7280] leading-5">
											Use score-based thresholds to instantly approve, reject,
											or flag applications for review.
										</p>
									</div>
								</div>
								<Button
									type="button"
									color={isWorthScoreActive ? "blue" : "grey"}
									outline={!isWorthScoreActive}
									className="ml-4 flex-shrink-0"
									onClick={(e) => {
										e.preventDefault();
										e.stopPropagation();
										handleWorthScoreButtonClick();
									}}
									onMouseDown={(e) => {
										// Prevent card click from firing when button is clicked
										e.stopPropagation();
									}}
								>
									{isWorthScoreActive ? "Configure Score" : "Configured"}
								</Button>
							</div>

							<div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 pt-6 border-t border-[#E5E7EB]">
								<div>
									<div className="flex items-center gap-2 mb-2">
										<RocketLaunchIcon
											className={twMerge(
												"w-5 h-5 flex-shrink-0",
												isWorthScoreActive
													? "text-worth-purple"
													: "text-[#6B7280]",
											)}
										/>
										<h4 className="text-sm font-semibold text-[#1F2937] leading-5">
											What it does for you
										</h4>
									</div>
									<p className="text-sm text-[#6B7280] leading-5">
										Automates decisions based on a single, powerful risk score,
										enabling you to process applications at scale with minimal
										effort.
									</p>
								</div>
								<div>
									<div className="flex items-center gap-2 mb-2">
										<ClockIcon
											className={twMerge(
												"w-5 h-5 flex-shrink-0",
												isWorthScoreActive
													? "text-worth-purple"
													: "text-[#6B7280]",
											)}
										/>
										<h4 className="text-sm font-semibold text-[#1F2937] leading-5">
											Time to set up
										</h4>
									</div>
									<p className="text-sm text-[#6B7280] leading-5">
										Get up and running in minutes. Just define your score ranges
										for approve, reject, and manual review.
									</p>
								</div>
								<div>
									<div className="flex items-center gap-2 mb-2">
										<LightBulbIcon
											className={twMerge(
												"w-5 h-5 flex-shrink-0",
												isWorthScoreActive
													? "text-worth-purple"
													: "text-[#6B7280]",
											)}
										/>
										<h4 className="text-sm font-semibold text-[#1F2937] leading-5">
											Why choose this?
										</h4>
									</div>
									<p className="text-sm text-[#6B7280] leading-5">
										Ideal for teams that want a fast, simple, and effective way
										to automate the bulk of their decision-making process.
									</p>
								</div>
							</div>
						</div>

						{/* Custom Workflows Card */}
						<div
							className={getCardClassName(isCustomWorkflowActive)}
							onClick={(e) => {
								// Only handle card click if user can write and not clicking on interactive elements
								if (
									!canWrite ||
									!shouldHandleCardClick(e.target as HTMLElement)
								) {
									return;
								}
								handleCustomWorkflowCardClick();
							}}
						>
							<div className="flex items-start justify-between mb-4">
								<div className="flex items-center gap-4 flex-1">
									<div
										className={twMerge(
											"w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 border",
											isCustomWorkflowActive
												? "bg-worth-purple-light border-worth-purple"
												: "bg-white border-[#E5E7EB]",
										)}
									>
										<CustomWorkflowIcon
											className={twMerge(
												"w-6 h-6",
												isCustomWorkflowActive
													? "text-worth-purple"
													: "text-[#6B7280]",
											)}
										/>
									</div>
									<div className="flex-1">
										<h3 className="text-lg font-semibold text-[#1F2937] leading-6 mb-1">
											Custom Workflows
										</h3>
										<p className="text-sm text-[#6B7280] leading-5">
											Use IF/THEN rules to route applications (Approve, Reject,
											Manual Review). Worth Score is shown for reference only;
											it won&apos;t make decisions.
										</p>
									</div>
								</div>
								<Button
									type="button"
									color={isCustomWorkflowActive ? "blue" : "grey"}
									outline={!isCustomWorkflowActive}
									className="ml-4 flex-shrink-0"
									onClick={(e) => {
										e.preventDefault();
										e.stopPropagation();
										handleCustomWorkflowButtonClick();
									}}
									onMouseDown={(e) => {
										e.stopPropagation();
									}}
								>
									{isCustomWorkflowActive ? "Explore Workflows" : "Begin Setup"}
								</Button>
							</div>

							<div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 pt-6 border-t border-[#E5E7EB]">
								<div>
									<div className="flex items-center gap-2 mb-2">
										<RectangleStackIcon
											className={twMerge(
												"w-5 h-5 flex-shrink-0",
												isCustomWorkflowActive
													? "text-worth-purple"
													: "text-[#6B7280]",
											)}
										/>
										<h4 className="text-sm font-semibold text-[#1F2937] leading-5">
											What it does for you
										</h4>
									</div>
									<p className="text-sm text-[#6B7280] leading-5">
										Gives you granular control to create bespoke logic for
										different products, risk levels, or customer segments.
									</p>
								</div>
								<div>
									<div className="flex items-center gap-2 mb-2">
										<ClockIcon
											className={twMerge(
												"w-5 h-5 flex-shrink-0",
												isCustomWorkflowActive
													? "text-worth-purple"
													: "text-[#6B7280]",
											)}
										/>
										<h4 className="text-sm font-semibold text-[#1F2937] leading-5">
											Time to set up
										</h4>
									</div>
									<p className="text-sm text-[#6B7280] leading-5">
										Requires more planning and setup, but offers unparalleled
										flexibility. Estimated setup: 1-2 hours per workflow.
									</p>
								</div>
								<div>
									<div className="flex items-center gap-2 mb-2">
										<CursorArrowRaysIcon
											className={twMerge(
												"w-5 h-5 flex-shrink-0",
												isCustomWorkflowActive
													? "text-worth-purple"
													: "text-[#6B7280]",
											)}
										/>
										<h4 className="text-sm font-semibold text-[#1F2937] leading-5">
											Why choose this?
										</h4>
									</div>
									<p className="text-sm text-[#6B7280] leading-5">
										Perfect for teams with unique underwriting requirements or
										those who need to manage multiple, distinct decision paths.
									</p>
								</div>
							</div>
						</div>
					</>
				)}
			</div>

			<WorkflowModal
				isOpen={showEnableCustomWorkflowModal}
				onClose={() => {
					setShowEnableCustomWorkflowModal(false);
				}}
				onSucess={handleEnableCustomWorkflow}
				title="Enable Custom Workflows"
				description={
					<>
						<p className="font-medium text-base mb-3">
							When Custom Workflows are on:
						</p>
						<ul className="list-disc list-inside font-normal text-sm leading-6">
							<li>Decisions are made by your workflow rules.</li>
							<li>
								Worth Score will not auto-approve or auto-reject (it remains
								visible for reference).
							</li>
						</ul>
					</>
				}
				buttonText="Enable & Configure"
			/>

			<WorkflowModal
				isOpen={showSwitchToWorthScoreModal}
				onClose={() => {
					setShowSwitchToWorthScoreModal(false);
				}}
				onSucess={handleSwitchToWorthScore}
				title="Switch to Worth Score?"
				description={
					<>
						<p className="font-medium text-base mb-3">
							When Worth Score is on:
						</p>
						<ul className="list-disc list-inside font-normal text-sm leading-6">
							<li>
								Worth Score thresholds will control
								auto-approve/auto-reject/manual review.
							</li>
							<li>
								Impact: Existing in-review cases are unaffected. New decisions
								use Worth Score after the effective time.
							</li>
						</ul>
					</>
				}
				buttonText="Switch & Configure"
			/>
		</div>
	);
};

export default DecisioningSelection;
