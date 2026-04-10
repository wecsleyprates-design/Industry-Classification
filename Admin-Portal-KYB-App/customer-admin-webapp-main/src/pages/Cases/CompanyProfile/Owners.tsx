import React, { type FC, useEffect, useState } from "react";
import { formatPhoneNumber } from "react-phone-number-input";
import {
	ArrowDownTrayIcon,
	EyeIcon,
	EyeSlashIcon,
	InformationCircleIcon,
} from "@heroicons/react/24/outline";
import { twMerge } from "tailwind-merge";
import ConditionalPlusIcon from "@/assets/ConditionalPlusIcon";
import StatusBadge, { type Ttype } from "@/components/Badge/StatusBadge";
import { TitleLeftDivider } from "@/components/Dividers";
import Tooltip from "@/components/Tooltip";
import {
	concatenateAddress,
	formatSSN,
	getPlaidIdvRiskScoreLevel,
} from "@/lib/helper";
import { useGetOnboardingSetup } from "@/services/queries/case.query";
import {
	useGetApplicantsVerificationDetails,
	useGetEquifaxCreditReport,
} from "@/services/queries/integration.query";

import { GuestOwnerStyle } from "@/constants/TailwindStyles";

interface Props {
	equifaxData: Record<string, any>;
	owners: any;
	businessId: string;
	customerId: string;
	caseId: string;
}

const Owners: FC<Props> = ({
	equifaxData,
	owners,
	businessId,
	customerId,
	caseId,
}) => {
	const controlOwner =
		owners?.filter((item: any) => item.owner_type === "CONTROL") || [];
	const nonControlOwners =
		owners?.filter((item: any) => item.owner_type !== "CONTROL") || [];

	const [enrichedOwners, setEnrichedOwners] = useState<any>([]);

	const ownerList = [...controlOwner, ...nonControlOwners];
	const [viewSSNs, setViewSSNs] = useState(
		new Array(ownerList.length).fill(false),
	);

	const toggleSSNVisibility = (index: number) => {
		const newViewSSNs = [...viewSSNs];
		newViewSSNs[index] = !newViewSSNs[index];
		setViewSSNs(newViewSSNs);
	};

	const applicantsVerificationData = useGetApplicantsVerificationDetails({
		applicantIds: ownerList.map((owner: any) => owner.id),
		businessId: businessId ?? "",
	});

	const { data: eqifaxCreditReportData } = useGetEquifaxCreditReport(
		businessId,
		caseId ?? "",
	);

	const { data: onboardingSetupData } = useGetOnboardingSetup(customerId ?? "");
	// relevant status types and their corresponding icon types and text
	const controlPersonAttributeStatuses = new Map<
		string,
		{ type: Ttype; text: string }
	>([
		["match", { type: "green_tick", text: "Match" }],
		["success", { type: "green_tick", text: "Match" }],
		["manually_approved", { type: "green_tick", text: "Match" }],
		["verified", { type: "green_tick", text: "Verified" }],
		["yes", { type: "green_tick", text: "Yes" }],
		["pending", { type: "gray_clock", text: "Pending" }],
		["active", { type: "gray_clock", text: "Pending" }],
		["waiting_for_prerequisite", { type: "gray_clock", text: "Pending" }],
		["pending_review", { type: "gray_clock", text: "Pending" }],
		["partial_match", { type: "warning", text: "Partial Match" }],
		["no_match", { type: "red_cross", text: "No Match" }],
		["failed", { type: "red_cross", text: "Failed" }],
		["expired", { type: "red_cross", text: "Expired" }],
		["no_data", { type: "red_cross", text: "No Data" }],
		["no_input", { type: "red_cross", text: "Not Provided" }],
		["canceled", { type: "red_cross", text: "Failed" }],
		["manually_rejected", { type: "red_cross", text: "Failed" }],
		["no", { type: "red_cross", text: "No" }],
	]);

	const userBehaviorStatuses = new Map<string, string>([
		["genuine", "Genuine"],
		["risky", "Risky"],
		["neutral", "Neutral"],
		["no_data", "-"],
	]);

	const addressTypeStatuses = new Map<string, string>([
		["residential", "Residential"],
		["commercial", "Commercial"],
		["no_data", "-"],
	]);

	useEffect(() => {
		if (
			applicantsVerificationData.length > 0 &&
			applicantsVerificationData.every((item) =>
				["success", "error"].includes(item.status),
			)
		) {
			// update the owners list with the verification data
			// order is preserved with each call, so owners will be in the same order as the applicantsVerificationData
			const enriched = ownerList.map((owner, index) => ({
				...owner,
				verificationData: applicantsVerificationData[index]?.data?.data,
			}));
			if (JSON.stringify(enriched) !== JSON.stringify(enrichedOwners)) {
				setEnrichedOwners(enriched);
			}
		}
	}, [applicantsVerificationData]);

	return (
		<div>
			{!enrichedOwners.length && ownerList.length ? (
				<div>
					<div className="py-2">
						<TitleLeftDivider text={"Owners"} />
					</div>
					<div className="container mx-auto">
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-1 md:grid-cols-1">
							<div className="p-4">
								<p className="py-2 text-sm font-normal tracking-tight text-gray-500">
									Loading Owners...
								</p>
							</div>
						</div>
					</div>
				</div>
			) : (
				enrichedOwners?.map((owner: any, index: number) => {
					const idvEnabled =
						owner?.verificationData?.identity_verification_attempted ?? true;
					return (
						<div key={index}>
							<div className="py-2">
								<TitleLeftDivider
									text={
										owner?.owner_type === "CONTROL"
											? "Control person"
											: `Beneficial Owner ${
													controlOwner.length > 1 ? index - 1 : index
												}`
									}
									badgeText={
										idvEnabled === false
											? "Not Verified - IDV Disabled"
											: owner?.verificationData?.applicant?.status === "SUCCESS"
												? "Verified"
												: owner?.verificationData?.applicant?.status ===
													  "PENDING"
													? "Verification Pending"
													: "Verification Failed"
									}
									badgeType={
										idvEnabled === false
											? "gray_info"
											: owner?.verificationData?.applicant?.status === "SUCCESS"
												? "blue_tick"
												: owner?.verificationData?.applicant?.status ===
													  "PENDING"
													? "yellow_clock_bg"
													: "red_exclamation_circle"
									}
								/>
							</div>
							<div className="container mx-auto">
								<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
									<div className="p-4">
										<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
											First name
										</p>
										<p
											className={twMerge(
												"py-2 text-sm font-medium tracking-tight break-words text-slate-800",
												owner?.guest_owner_edits?.includes("first_name") &&
													GuestOwnerStyle,
											)}
										>
											{owner?.first_name ?? "-"}
											<ConditionalPlusIcon
												isNotapplicant={owner?.guest_owner_edits?.includes(
													"first_name",
												)}
											/>
										</p>
										{idvEnabled && (
											<StatusBadge
												type={
													owner?.first_name
														? (controlPersonAttributeStatuses.get(
																owner?.verificationData?.applicant
																	?.risk_check_result?.name,
															)?.type ?? "red_cross")
														: "red_cross"
												}
												text={
													owner?.first_name
														? (controlPersonAttributeStatuses.get(
																owner?.verificationData?.applicant
																	?.risk_check_result?.name,
															)?.text ?? "No Match")
														: "Not Provided"
												}
											></StatusBadge>
										)}
									</div>
									<div className="p-4">
										<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
											Last name
										</p>
										<p
											className={twMerge(
												"py-2 text-sm font-medium tracking-tight break-words text-slate-800",
												owner?.guest_owner_edits?.includes("last_name") &&
													GuestOwnerStyle,
											)}
										>
											{owner?.last_name ?? "-"}
											<ConditionalPlusIcon
												isNotapplicant={owner?.guest_owner_edits?.includes(
													"last_name",
												)}
											/>
										</p>
										{idvEnabled && (
											<StatusBadge
												type={
													owner?.last_name
														? (controlPersonAttributeStatuses.get(
																owner?.verificationData?.applicant
																	?.risk_check_result?.name,
															)?.type ?? "red_cross")
														: "red_cross"
												}
												text={
													owner?.last_name
														? (controlPersonAttributeStatuses.get(
																owner?.verificationData?.applicant
																	?.risk_check_result?.name,
															)?.text ?? "No Match")
														: "Not Provided"
												}
											></StatusBadge>
										)}
									</div>
									<div className="p-4">
										<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
											DOB
										</p>
										<p
											className={twMerge(
												"py-2 text-sm font-medium tracking-tight break-words text-slate-800",
												owner?.guest_owner_edits?.includes("date_of_birth") &&
													GuestOwnerStyle,
											)}
										>
											{owner?.date_of_birth ?? "-"}
											<ConditionalPlusIcon
												isNotapplicant={owner?.guest_owner_edits?.includes(
													"date_of_birth",
												)}
											/>
										</p>
										{idvEnabled && (
											<StatusBadge
												type={
													owner?.date_of_birth
														? (controlPersonAttributeStatuses.get(
																owner?.verificationData?.applicant
																	?.risk_check_result?.dob,
															)?.type ?? "red_cross")
														: "red_cross"
												}
												text={
													owner?.date_of_birth
														? (controlPersonAttributeStatuses.get(
																owner?.verificationData?.applicant
																	?.risk_check_result?.dob,
															)?.text ?? "No Match")
														: "Not Provided"
												}
											></StatusBadge>
										)}
									</div>

									<div className="p-4">
										<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
											SSN
										</p>
										{owner?.ssn ? (
											<div
												className={twMerge(
													"flex flex-row py-1",
													owner?.guest_owner_edits?.includes("ssn") &&
														GuestOwnerStyle,
												)}
											>
												<div className="flex flex-row w-20 py-2 mr-2 text-sm font-medium tracking-tight whitespace-nowrap text-slate-800">
													{formatSSN(owner?.ssn, viewSSNs[index])}
												</div>
												<div
													onClick={() => {
														toggleSSNVisibility(index);
													}}
													className="inset-y-0 right-0 flex items-center pl-1"
												>
													{viewSSNs[index] ? (
														<EyeIcon className="w-5 h-5" aria-hidden="true" />
													) : (
														<EyeSlashIcon
															className="w-5 h-5"
															aria-hidden="true"
														/>
													)}
													<ConditionalPlusIcon
														isNotapplicant={owner?.guest_owner_edits?.includes(
															"ssn",
														)}
													/>
												</div>
											</div>
										) : (
											"-"
										)}
										{idvEnabled && (
											<StatusBadge
												type={
													owner?.ssn
														? (controlPersonAttributeStatuses.get(
																owner?.verificationData?.applicant
																	?.risk_check_result?.ssn,
															)?.type ?? "red_cross")
														: "red_cross"
												}
												text={
													owner?.ssn
														? (controlPersonAttributeStatuses.get(
																owner?.verificationData?.applicant
																	?.risk_check_result?.ssn,
															)?.text ?? "No Match")
														: "Not Provided"
												}
											></StatusBadge>
										)}
									</div>
									<div className="col-span-2 p-4">
										<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
											Home address
										</p>
										<p
											className={twMerge(
												"py-2 text-sm font-medium tracking-tight break-words text-slate-800",
												[
													"address_line_1",
													"address_city",
													"address_postal_code",
													"address_state",
													"address_apartment",
												].some((e: any) =>
													owner?.guest_owner_edits?.includes(e),
												) && GuestOwnerStyle,
											)}
										>
											{concatenateAddress([
												owner?.address_apartment as string,
												owner?.address_line_1 as string,
												owner?.address_line_2 as string,
												owner?.address_city as string,
												(owner?.address_state as string) +
													" " +
													(owner?.address_postal_code as string),
											])}
											<ConditionalPlusIcon
												isNotapplicant={[
													"address_line_1",
													"address_city",
													"address_postal_code",
													"address_state",
													"address_apartment",
												].some((e: any) =>
													owner?.guest_owner_edits?.includes(e),
												)}
											/>
										</p>
										{idvEnabled && (
											<StatusBadge
												type={
													owner?.address_postal_code
														? (controlPersonAttributeStatuses.get(
																owner?.verificationData?.applicant
																	?.risk_check_result?.address?.summary,
															)?.type ?? "red_cross")
														: "red_cross"
												}
												text={
													owner?.address_postal_code
														? (controlPersonAttributeStatuses.get(
																owner?.verificationData?.applicant
																	?.risk_check_result?.address?.summary,
															)?.text ?? "No Match")
														: "Not Provided"
												}
											></StatusBadge>
										)}
									</div>
									<div className="w-full p-4">
										<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
											Home Address Type
										</p>
										<p className="py-2 text-sm font-medium tracking-tight break-words text-slate-800">
											{owner?.address_postal_code
												? addressTypeStatuses.get(
														owner.verificationData?.applicant?.risk_check_result
															?.address?.type,
													)
												: "-"}
										</p>
									</div>
									<div className="w-full p-4">
										<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
											Email Address
										</p>
										<p
											className={twMerge(
												"py-2 text-sm font-medium tracking-tight break-words text-slate-800",
												owner?.guest_owner_edits?.includes("email") &&
													GuestOwnerStyle,
											)}
										>
											{owner?.email ?? "-"}
											<ConditionalPlusIcon
												isNotapplicant={owner?.guest_owner_edits?.includes(
													"email",
												)}
											/>
										</p>
										{idvEnabled && (
											<StatusBadge
												type={
													owner?.email
														? (controlPersonAttributeStatuses.get(
																owner?.verificationData?.applicant
																	?.risk_check_result?.email?.is_deliverable ===
																	"yes"
																	? "verified"
																	: owner?.verificationData?.applicant
																			?.risk_check_result?.email
																			?.is_deliverable,
															)?.type ?? "red_cross")
														: "red_cross"
												}
												text={
													owner?.email
														? (controlPersonAttributeStatuses.get(
																owner?.verificationData?.applicant
																	?.risk_check_result?.email?.is_deliverable ===
																	"yes"
																	? "verified"
																	: "",
															)?.text ?? "Not Verified")
														: "Not Provided"
												}
											></StatusBadge>
										)}
									</div>

									<div className="p-4">
										<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
											Ownership %
										</p>
										<p
											className={twMerge(
												"py-2 text-sm font-medium tracking-tight break-words text-slate-800",
												owner?.guest_owner_edits?.includes(
													"ownership_percentage",
												) && GuestOwnerStyle,
											)}
										>
											{owner?.ownership_percentage ?? "-"}
											<ConditionalPlusIcon
												isNotapplicant={owner?.guest_owner_edits?.includes(
													"ownership_percentage",
												)}
											/>
										</p>
									</div>
									<div className="w-full p-4">
										<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
											Document
										</p>
										<p className="py-2 text-sm font-medium tracking-tight break-words text-slate-800">
											No file uploaded
										</p>
										{idvEnabled &&
										controlPersonAttributeStatuses.get(
											owner?.verificationData?.applicant?.risk_check_result
												?.documents_verification,
										) !== undefined ? (
											<StatusBadge
												type={
													controlPersonAttributeStatuses.get(
														owner?.verificationData?.applicant
															?.risk_check_result?.documents_verification,
													)?.type ?? "red_cross"
												}
												text={
													controlPersonAttributeStatuses.get(
														owner?.verificationData?.applicant
															?.risk_check_result?.documents_verification,
													)?.text ?? "No Data"
												}
											/>
										) : (
											<StatusBadge type="red_cross" text="No Data" />
										)}
									</div>
									{onboardingSetupData?.data?.find(
										(element) => element.code === "equifax_credit_score_setup",
									)?.is_enabled ? (
										<div className="w-full p-4">
											<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
												VantageScore® 4.0
											</p>
											<p className="py-2 text-sm font-medium tracking-tight break-words text-slate-800">
												<div
													className={twMerge(
														"flex items-center gap-x-1.5 tracking-tight break-words",
														eqifaxCreditReportData?.data?.[owner.id]
															?.signedRequest
															? "text-blue-500 cursor-pointer"
															: "",
													)}
													onClick={() => {
														const url =
															eqifaxCreditReportData?.data?.[owner.id]
																?.signedRequest;
														if (url) {
															window.open(url, "_blank");
														}
													}}
												>
													<>
														{equifaxData?.data?.[owner?.id]?.[0]?.score
															? String(
																	equifaxData?.data?.[owner?.id]?.[0]?.score,
																) + "/850"
															: "-"}
													</>
													{eqifaxCreditReportData?.data?.[owner.id]
														?.signedRequest ? (
														<ArrowDownTrayIcon
															height={16}
															strokeWidth={2}
															className="min-w-fit"
														/>
													) : null}
												</div>
											</p>
										</div>
									) : null}
									<div className="w-full p-4">
										<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
											Phone Number
										</p>
										<p
											className={twMerge(
												"py-2 text-sm font-medium tracking-tight break-words text-slate-800",
												owner?.guest_owner_edits?.includes("mobile") &&
													GuestOwnerStyle,
											)}
										>
											{formatPhoneNumber(owner.mobile) ?? "-"}
											<ConditionalPlusIcon
												isNotapplicant={owner?.guest_owner_edits?.includes(
													"mobile",
												)}
											/>
										</p>
										{idvEnabled && (
											<StatusBadge
												type={
													owner.mobile
														? (controlPersonAttributeStatuses.get(
																owner?.verificationData?.applicant
																	?.risk_check_result?.phone?.summary,
															)?.type ?? "red_cross")
														: "red_cross"
												}
												text={
													owner.mobile
														? (controlPersonAttributeStatuses.get(
																owner?.verificationData?.applicant
																	?.risk_check_result?.phone?.summary,
															)?.text ?? "No Match")
														: "Not Provided"
												}
											></StatusBadge>
										)}
									</div>
									<div className="w-full p-4">
										<p className="inline-flex py-2 text-xs font-normal tracking-tight text-gray-500">
											User Interactions
											<Tooltip
												tooltip={
													"Represents how familiar the user is with the personal data they provide, based on a number of signals that are collected during onboarding."
												}
												isLeft
											>
												<InformationCircleIcon
													className="w-5 h-5 ml-2 text-gray-400"
													aria-hidden="true"
												/>
											</Tooltip>
										</p>
										<p className="py-2 text-sm font-medium tracking-tight break-words text-slate-800">
											{userBehaviorStatuses.get(
												owner?.verificationData?.applicant?.risk_check_result
													?.user_interactions,
											) ?? "-"}
										</p>
									</div>
									<div className="w-full p-4">
										<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
											Synthetic Identity Risk Score
										</p>
										<p className="py-2 text-sm font-medium tracking-tight break-words text-slate-800">
											{owner.verificationData?.applicant?.risk_check_result
												?.synthetic_identity_risk_score ?? "-"}
										</p>
										{idvEnabled &&
											owner?.verificationData?.applicant?.risk_check_result
												?.synthetic_identity_risk_score != null && (
												<StatusBadge
													type={
														getPlaidIdvRiskScoreLevel(
															owner?.verificationData?.applicant
																?.risk_check_result
																?.synthetic_identity_risk_score,
														)?.type ?? "warning"
													}
													text={
														getPlaidIdvRiskScoreLevel(
															owner?.verificationData?.applicant
																?.risk_check_result
																?.synthetic_identity_risk_score,
														)?.text ?? "No Data"
													}
												/>
											)}
									</div>
									<div className="w-full p-4">
										<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
											Stolen Identity Risk Score
										</p>
										<p className="py-2 text-sm font-medium tracking-tight break-words text-slate-800">
											{owner.verificationData?.applicant?.risk_check_result
												?.stolen_identity_risk_score ?? "-"}
										</p>
										{idvEnabled &&
											owner?.verificationData?.applicant?.risk_check_result
												?.stolen_identity_risk_score != null && (
												<StatusBadge
													type={
														getPlaidIdvRiskScoreLevel(
															owner?.verificationData?.applicant
																?.risk_check_result?.stolen_identity_risk_score,
														)?.type ?? "warning"
													}
													text={
														getPlaidIdvRiskScoreLevel(
															owner?.verificationData?.applicant
																?.risk_check_result?.stolen_identity_risk_score,
														)?.text ?? "No Data"
													}
												></StatusBadge>
											)}
									</div>
									<div className="w-full p-4">
										<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
											Email Deliverable
										</p>
										<p className="py-2 text-sm font-medium tracking-tight break-words text-slate-800">
											{controlPersonAttributeStatuses.get(
												owner.verificationData?.applicant?.risk_check_result
													?.email?.is_deliverable,
											)?.text ?? "-"}
										</p>
									</div>
									<div className="w-full p-4">
										<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
											Email Breach Count
										</p>
										<p className="py-2 text-sm font-medium tracking-tight break-words text-slate-800">
											{owner.verificationData?.applicant?.risk_check_result
												?.email?.breach_count ?? "-"}
										</p>
									</div>
									<div className="w-full p-4">
										<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
											Email First Breached
										</p>
										<p className="py-2 text-sm font-medium tracking-tight break-words text-slate-800">
											{owner.verificationData?.applicant?.risk_check_result
												?.email?.first_breached_at ?? "-"}
										</p>
									</div>
									<div className="w-full p-4">
										<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
											Email Last Breached
										</p>
										<p className="py-2 text-sm font-medium tracking-tight break-words text-slate-800">
											{owner.verificationData?.applicant?.risk_check_result
												?.email?.last_breached_at ?? "-"}
										</p>
									</div>
									<div className="w-full p-4">
										<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
											Email Domain Registration Date
										</p>
										<p className="py-2 text-sm font-medium tracking-tight break-words text-slate-800">
											{owner.verificationData?.applicant?.risk_check_result
												?.email?.domain_registered_at ?? "-"}
										</p>
									</div>
									<div className="w-full p-4">
										<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
											Free Email Domain Provider?
										</p>
										<p className="py-2 text-sm font-medium tracking-tight break-words text-slate-800">
											{controlPersonAttributeStatuses.get(
												owner.verificationData?.applicant?.risk_check_result
													?.email?.domain_is_free_provider,
											)?.text ?? "-"}
										</p>
									</div>
									<div className="w-full p-4">
										<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
											Custom Email Domain?
										</p>
										<p className="py-2 text-sm font-medium tracking-tight break-words text-slate-800">
											{controlPersonAttributeStatuses.get(
												owner.verificationData?.applicant?.risk_check_result
													?.email?.domain_is_custom,
											)?.text ?? "-"}
										</p>
									</div>
									<div className="w-full p-4">
										<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
											Disposible Email Domain?
										</p>
										<p className="py-2 text-sm font-medium tracking-tight break-words text-slate-800">
											{controlPersonAttributeStatuses.get(
												owner.verificationData?.applicant?.risk_check_result
													?.email?.domain_is_disposable,
											)?.text ?? "-"}
										</p>
									</div>
									<div className="w-full p-4">
										<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
											Suspicious Top Level Email Domain?
										</p>
										<p className="py-2 text-sm font-medium tracking-tight break-words text-slate-800">
											{controlPersonAttributeStatuses.get(
												owner.verificationData?.applicant?.risk_check_result
													?.email?.top_level_domain_is_suspicious,
											)?.text ?? "-"}
										</p>
									</div>
									<div className="w-full p-4">
										<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
											IP Spam List Count
										</p>
										<p className="py-2 text-sm font-medium tracking-tight break-words text-slate-800">
											{owner.verificationData?.applicant?.risk_check_result
												?.ip_spam_list_count ?? "-"}
										</p>
									</div>
								</div>
							</div>
						</div>
					);
				})
			)}
		</div>
	);
};

export default Owners;
