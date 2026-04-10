import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
	ArrowPathIcon,
	ExclamationTriangleIcon,
	InformationCircleIcon,
} from "@heroicons/react/24/outline";
import { MatchSignalBadge } from "./MatchSignalBadge";
import { type MatchICAUIResult, MatchStatus } from "./types";
import { getMatchStatusDefinition, resolveMatchStatus } from "./utils";

import { REASON_CODE_MAP } from "@/constants/ReasonCodes";
import { Badge, VerificationBadge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Checkbox } from "@/ui/checkbox";
import {
	Modal,
	ModalBody,
	ModalContent,
	ModalFooter,
	ModalHeader,
} from "@/ui/modal";

/** ICA card row rendered inside the modal list */
const ICACardItem: React.FC<{
	item: MatchICAUIResult;
	isSelected: boolean;
	isSubmitting: boolean;
	onToggle: (ica: string, checked: boolean) => void;
}> = ({ item, isSelected, isSubmitting, onToggle }) => {
	const statusDef = getMatchStatusDefinition(resolveMatchStatus(item));
	const StatusIcon = statusDef.icon;

	return (
		<div
			className={`flex items-start space-x-3 p-4 border rounded-lg transition-colors ${
				isSelected
					? "bg-accent/50 border-primary/50"
					: "bg-card border-border"
			}`}
		>
			<Checkbox
				id={`ica-${item.ica}`}
				checked={isSelected}
				onCheckedChange={(checked) => {
					onToggle(item.ica, checked === true);
				}}
				disabled={isSubmitting}
				className="mt-1"
			/>
			<div className="flex-1 space-y-3">
				{/* Header: Acquirer ID + Status */}
				<div className="flex items-center justify-between">
					<span className="font-bold text-sm">
						Acquirer ID: {item.ica}
					</span>
					<div className="flex items-center gap-1.5">
						<VerificationBadge
							variant={statusDef.variant}
							className="text-xs gap-1"
						>
							{statusDef.text}
						</VerificationBadge>
					</div>
				</div>

				{item.status === MatchStatus.NOT_SUBMITTED ? (
					<div className="flex items-center gap-1.5 text-xs text-gray-500 py-1.5">
						<InformationCircleIcon className="w-3.5 h-3.5 shrink-0" />
						This acquirer ID has not been submitted for matching
						yet.
					</div>
				) : item.status === MatchStatus.MATCH_ERROR && item.errors ? (
					<div className="space-y-2">
						{item.errors.map((err, idx) => (
							<div
								key={err.ReasonCode ?? idx}
								className="flex items-start gap-1.5 text-xs text-red-700 pr-2.5 py-1.5 rounded"
							>
								<ExclamationTriangleIcon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
								<div>
									<p>{err.Details || err.Description}</p>
									{err.ReasonCode ? (
										<p className="text-red-500 mt-0.5">
											Error Code: {err.ReasonCode}
										</p>
									) : null}
								</div>
							</div>
						))}
					</div>
				) : (
					<>
						{/* Merchant Details */}
						<div className="text-sm text-gray-500 border-b last:border-0 border-gray-100 pb-4 last:pb-0">
							<div className="font-regular uppercase">
								Merchant Name:{" "}
								<span className="text-gray-900">
									{item.inquiryDetails?.name ?? "N/A"}
								</span>
							</div>
							<div className="flex items-center gap-x-6 mt-1 font-regular">
								{item.inquiryDetails?.address ? (
									<span>
										Address:{" "}
										<span className="text-gray-900">
											{item.inquiryDetails.address}
										</span>
									</span>
								) : null}
								{item.inquiryDetails?.category ? (
									<span>
										Category:{" "}
										<span className="text-gray-900">
											{item.inquiryDetails.category}
										</span>
									</span>
								) : null}
							</div>
						</div>

						{/* Results / Status Specifics */}
						{item.status === MatchStatus.RESULTS_FOUND &&
						item.matches ? (
							<div className="space-y-2 pt-1">
								{/* Reason Codes */}
								{item.matches.reasonCodes.length > 0 ? (
									<div className="border-b border-gray-100 pb-4">
										<p className="text-xs font-medium text-gray-500 mb-1.5">
											Reason Codes:
										</p>
										<div className="flex flex-wrap gap-1.5">
											{item.matches.reasonCodes.map(
												(rc) => {
													const def = REASON_CODE_MAP[
														Number(rc.code)
													] ?? { title: "Unknown" };
													return (
														<Badge
															key={rc.code}
															variant="secondary"
															className="text-xs"
														>
															{rc.code} –{" "}
															{def.title}
														</Badge>
													);
												},
											)}
										</div>
									</div>
								) : null}
								{/* Match Strength */}
								<div>
									<p className="text-xs font-medium text-gray-500 mb-1.5">
										Match Strength:
									</p>
									<div className="flex flex-wrap gap-1.5">
										<MatchSignalBadge
											label="Business Name"
											value={
												item.matches.matchSignal
													.businessNameMatch
											}
										/>
										<MatchSignalBadge
											label="DBA"
											value={
												item.matches.matchSignal
													.dbaMatch
											}
										/>
										<MatchSignalBadge
											label="Address"
											value={
												item.matches.matchSignal
													.addressMatch
											}
										/>
										{item.matches.matchSignal.principalMatch
											.length > 0 ? (
											<>
												<MatchSignalBadge
													label="Principal Name"
													value={
														item.matches.matchSignal
															.principalMatch[0]
															?.name
													}
												/>
												<MatchSignalBadge
													label="Principal Address"
													value={
														item.matches.matchSignal
															.principalMatch[0]
															?.address
													}
												/>
											</>
										) : null}
									</div>
								</div>
							</div>
						) : item.status === MatchStatus.NO_RESULTS_FOUND ? (
							<div className="flex items-start gap-1.5 text-xs text-green-700 pr-2.5 py-1.5 rounded w-fit">
								{StatusIcon ? (
									<StatusIcon className="w-3.5 h-3.5 shrink-0" />
								) : null}
								{statusDef.description}
							</div>
						) : null}
					</>
				)}
			</div>
		</div>
	);
};

/** Section select-all + ICA card list */
const ICASection: React.FC<{
	title: string;
	items: MatchICAUIResult[];
	selectedIcas: Set<string>;
	isSubmitting: boolean;
	onToggleIca: (ica: string, checked: boolean) => void;
	onToggleSection: (icaIds: string[], checked: boolean) => void;
}> = ({
	title,
	items,
	selectedIcas,
	isSubmitting,
	onToggleIca,
	onToggleSection,
}) => {
	const sectionIcaIds = useMemo(() => items.map((i) => i.ica), [items]);
	const selectedInSection = sectionIcaIds.filter((id) =>
		selectedIcas.has(id),
	).length;
	const isAllSelected =
		items.length > 0 && selectedInSection === items.length;
	const isIndeterminate =
		selectedInSection > 0 && selectedInSection < items.length;

	return (
		<div className="space-y-3">
			<div className="flex items-center space-x-2">
				<Checkbox
					id={`select-all-${title
						.toLowerCase()
						.replace(/\s+/g, "-")}`}
					checked={
						isAllSelected ||
						(isIndeterminate ? "indeterminate" : false)
					}
					onCheckedChange={(checked) => {
						onToggleSection(sectionIcaIds, checked === true);
					}}
					disabled={isSubmitting}
				/>
				<label
					htmlFor={`select-all-${title
						.toLowerCase()
						.replace(/\s+/g, "-")}`}
					className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
				>
					{title} ({selectedInSection} of {items.length} selected)
				</label>
			</div>
			<div className="space-y-4">
				{items.map((item) => (
					<ICACardItem
						key={item.ica}
						item={item}
						isSelected={selectedIcas.has(item.ica)}
						isSubmitting={isSubmitting}
						onToggle={onToggleIca}
					/>
				))}
			</div>
		</div>
	);
};

interface ResubmitMatchModalProps {
	open: boolean;
	onClose: () => void;
	icas: MatchICAUIResult[];
	onSubmit: (icas: string[]) => void;
	isSubmitting: boolean;
}

export const ResubmitMatchModal: React.FC<ResubmitMatchModalProps> = ({
	open,
	onClose,
	icas,
	onSubmit,
	isSubmitting,
}) => {
	// Set for O(1) lookup instead of Array.includes (js-set-map-lookups)
	const [selectedIcas, setSelectedIcas] = useState<Set<string>>(new Set());

	// Split ICAs into previously run and available (not submitted)
	const { previouslyRun, available } = useMemo(() => {
		const prev: MatchICAUIResult[] = [];
		const avail: MatchICAUIResult[] = [];
		for (const item of icas) {
			if (item.status === MatchStatus.NOT_SUBMITTED) {
				avail.push(item);
			} else {
				prev.push(item);
			}
		}
		return { previouslyRun: prev, available: avail };
	}, [icas]);

	// Reset selection when modal opens
	useEffect(() => {
		if (open) {
			setSelectedIcas(new Set());
		}
	}, [open]);

	const handleToggleIca = useCallback((ica: string, checked: boolean) => {
		setSelectedIcas((prev) => {
			const next = new Set(prev);
			if (checked) {
				next.add(ica);
			} else {
				next.delete(ica);
			}
			return next;
		});
	}, []);

	const handleToggleSection = useCallback(
		(icaIds: string[], checked: boolean) => {
			setSelectedIcas((prev) => {
				const next = new Set(prev);
				for (const id of icaIds) {
					if (checked) {
						next.add(id);
					} else {
						next.delete(id);
					}
				}
				return next;
			});
		},
		[],
	);

	const handleSubmit = useCallback(() => {
		onSubmit([...selectedIcas]);
	}, [onSubmit, selectedIcas]);

	const selectedCount = selectedIcas.size;

	return (
		<Modal
			open={open}
			onOpenChange={(newOpen) => {
				if (!newOpen) onClose();
			}}
		>
			<ModalContent className="max-w-2xl p-0 overflow-hidden">
				<ModalHeader
					title="Select Acquirer IDs to Resubmit"
					subtitle="Choose one or more acquirer IDs to resubmit for matching"
					onClose={onClose}
					className="border-b border-border p-6"
				/>

				<ModalBody className="p-6">
					<div className="h-[400px] pr-2 overflow-y-auto space-y-6">
						{previouslyRun.length > 0 ? (
							<ICASection
								title="Previously Run"
								items={previouslyRun}
								selectedIcas={selectedIcas}
								isSubmitting={isSubmitting}
								onToggleIca={handleToggleIca}
								onToggleSection={handleToggleSection}
							/>
						) : null}

						{available.length > 0 ? (
							<ICASection
								title="Available ICAs"
								items={available}
								selectedIcas={selectedIcas}
								isSubmitting={isSubmitting}
								onToggleIca={handleToggleIca}
								onToggleSection={handleToggleSection}
							/>
						) : null}
					</div>
				</ModalBody>

				<ModalFooter className="border-t border-border p-6 bg-gray-50/50">
					<Button
						variant="outline"
						onClick={onClose}
						disabled={isSubmitting}
					>
						Cancel
					</Button>
					<Button
						onClick={handleSubmit}
						disabled={selectedCount === 0 || isSubmitting}
					>
						{isSubmitting ? (
							<ArrowPathIcon className="w-4 h-4 mr-2 animate-spin" />
						) : null}
						{isSubmitting ? "Submitting..." : "Resubmit"}
					</Button>
				</ModalFooter>
			</ModalContent>
		</Modal>
	);
};
