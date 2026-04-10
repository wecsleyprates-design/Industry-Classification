import { useEffect } from "react";
import { isNonEmptyArray, isNonEmptyString } from "@austinburns/type-guards";
import {
	ArrowDownTrayIcon,
	DocumentTextIcon,
	InformationCircleIcon,
} from "@heroicons/react/24/outline";
import cx from "classnames";
import StatusBadge from "@/components/Badge/StatusBadge";
import useCustomToast from "@/hooks/useCustomToast";
import { convertToLocalDate } from "@/lib/helper";
import { getTaxIdLabel } from "@/lib/taxIdLabels";
import { downloadVerificationUpload } from "@/services/api/integration.service";
import { useGetExtractedVerificationUploads } from "@/services/queries/integration.query";
import { EmptyState } from "./EmptyState";
import { SectionHeader } from "./SectionHeader";
import { SkeletonUI } from "./SkeletonUI";
import { useBusinessVerificationService } from "./useBusinessVerificationService";
import { WatchlistTitle } from "./WatchlistTitle";

const KnowYourBusiness = ({
	businessId,
	countryCode,
}: {
	businessId: string | null;
	countryCode?: string | undefined;
}) => {
	const businessID = isNonEmptyString(businessId) ? businessId : "n/a";
	const {
		submitBusinessVerficationOrderAsync,
		isInitialDataLoading,
		isMissingVerificationDataAndHasNotSubmittedYet,
		isVerificationOrderSubmittedAndPendingResults,
		businessVerificationDetailsError,
		submitBusinessVerificationOrderError,
		submitBusinessVerificationOrderSuccess,
		businessVerificationRecord,
		sortedRegistrations,
		sortedAddressSources,
		tinReviewTask,
		tinIsVerified,
		hasActiveFiling,
		businessNameReviewTask,
		businessNameIsVerified,
		businessNameMatches,
		businessNameBadgeLabel,
		businessNameBadgeType,
		registeredAgentReviewTask,
		addressVerificationReviewTask,
		addressIsVerified,
		addressBadgeLabel,
		addressBadgeType,
		watchlistReviewTask,
		watchlistHits,
		hasHits,
	} = useBusinessVerificationService({
		businessId: businessID,
	});
	const { errorHandler, successHandler } = useCustomToast();

	const { data: verificationUploadsData } =
		useGetExtractedVerificationUploads(businessID);

	useEffect(() => {
		if (businessVerificationDetailsError) {
			errorHandler(businessVerificationDetailsError);
		}

		if (submitBusinessVerificationOrderError) {
			errorHandler(submitBusinessVerificationOrderError);
		}
	}, [businessVerificationDetailsError, submitBusinessVerificationOrderError]);

	useEffect(() => {
		if (submitBusinessVerificationOrderSuccess) {
			successHandler({
				message: "Business verification order submitted successfully",
			});
		}
	}, [submitBusinessVerificationOrderSuccess]);

	if (isInitialDataLoading) {
		return <SkeletonUI countryCode={countryCode} />;
	}

	if (isMissingVerificationDataAndHasNotSubmittedYet) {
		return <EmptyState handleSubmit={submitBusinessVerficationOrderAsync} />;
	}

	// top-level business verification order was submitted and we're pending results
	if (isVerificationOrderSubmittedAndPendingResults) {
		return <SkeletonUI countryCode={countryCode} />;
	}

	return (
		<div className="flex flex-col gap-10 pt-2">
			{/* Tax ID Verification */}
			{tinReviewTask && businessVerificationRecord && (
				<section className="container mx-auto">
					<div className="flex flex-col gap-4">
						<SectionHeader
							titleText={getTaxIdLabel(countryCode, "sectionTitle")}
							badgeText={tinIsVerified ? "Verified" : tinReviewTask.sublabel}
							badgeType={
								tinIsVerified ? "green_tick" : "red_exclamation_circle"
							}
						/>
						{/* Verification Uploads */}
						{isNonEmptyArray(verificationUploadsData?.data) && (
							<div className="flex flex-col gap-y-2">
								<div className="flex flex-row justify-end w-full p-4 bg-gray-100 rounded-lg gap-x-2">
									<InformationCircleIcon className="w-[22px] h-[22px] text-gray-500 " />
									<div className="w-full ml-2 text-sm text-gray-500">
										We were unable to verify the{" "}
										{getTaxIdLabel(countryCode, "short")} and Business name
										provided. Please download and review the documents provided
										by the applicant below to manually verify the business's
										details.
									</div>
								</div>
								{verificationUploadsData?.data.map((upload) => (
									<div
										key={upload?.id}
										className="flex items-center justify-between p-4 border rounded-lg"
									>
										<div className="flex items-center gap-4 ">
											<span className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded-lg">
												<DocumentTextIcon
													height={20}
													strokeWidth={2}
													className="text-gray-800"
												/>
											</span>
											<div>
												<p className="mb-2 text-sm text-gray-900 truncate">
													{upload?.file_name ?? ""}
												</p>
												<StatusBadge
													type="green_tick"
													text={
														upload.extracted_data.documentType
															.replace(/confirmation letter/i, "")
															.trim()
															.replace(/^(?!Verified)(.*)/, "Verified $1") ?? ""
													}
													className={" gap-x-1.5"}
												/>
											</div>
										</div>
										<button
											onClick={async () => {
												try {
													await downloadVerificationUpload(
														businessID,
														upload.id,
														upload.file_name,
													);
													successHandler({
														message: `${upload.file_name} downloaded successfully`,
													});
												} catch (error) {
													errorHandler({ message: "Error downloading file" });
												}
											}}
											className="text-gray-800 hover:underline"
										>
											<ArrowDownTrayIcon height={18} />
										</button>
									</div>
								))}
							</div>
						)}

						{!tinIsVerified && (
							<p className="text-sm text-gray-600">{tinReviewTask.message}</p>
						)}

						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<div>
								<h3 className="py-1 text-xs font-light text-gray-500">
									Business name
								</h3>
								<p className="text-sm text-gray-700">
									{businessVerificationRecord.name}
								</p>
							</div>
							<div>
								<h3 className="py-1 text-xs font-light text-gray-500">
									{getTaxIdLabel(countryCode, "fieldLabel")}
								</h3>
								<p className="text-sm text-gray-700">
									{businessVerificationRecord.tin}
								</p>
							</div>
						</div>
					</div>
				</section>
			)}

			{/* Secretary of State Filings */}
			<section className="container mx-auto">
				<div className="flex flex-col gap-8">
					<SectionHeader
						titleText="Secretary of State Filings"
						badgeText={
							businessNameBadgeLabel === "Possible Match"
								? businessNameBadgeLabel
								: hasActiveFiling
									? "Verified"
									: "Missing Active Filing"
						}
						badgeType={
							businessNameBadgeLabel === "Possible Match"
								? "gray_exclamation_circle"
								: hasActiveFiling
									? "green_tick"
									: "red_exclamation_circle"
						}
					/>
					{isNonEmptyArray(sortedRegistrations) ? (
						<>
							{sortedRegistrations.map((registration, index) => (
								<div
									key={registration.id}
									className={cx(
										"grid grid-cols-1 sm:grid-cols-2 gap-4",
										index < sortedRegistrations.length - 1 &&
											"pb-4 border-b border-solid border-gray-100",
									)}
								>
									<div>
										<h3 className="py-1 text-xs font-light text-gray-500">
											Status
										</h3>
										<p className="text-sm text-gray-700">
											{registration.status.charAt(0).toUpperCase() +
												registration.status.slice(1)}
										</p>
									</div>
									<div>
										<h3 className="py-1 text-xs font-light text-gray-500">
											State
										</h3>
										<p className="text-sm text-gray-700">
											{registration.registration_state}
										</p>
									</div>
									<div>
										<h3 className="py-1 text-xs font-light text-gray-500">
											Legal entity name
										</h3>
										<p className="text-sm text-gray-700">{registration.name}</p>
									</div>
									<div>
										<h3 className="py-1 text-xs font-light text-gray-500">
											Registration date
										</h3>
										<p className="text-sm text-gray-700">
											{convertToLocalDate(
												new Date(registration.registration_date),
												"MM-DD-YYYY",
											)}
										</p>
									</div>
									<div>
										<h3 className="py-1 text-xs font-light text-gray-500">
											Entity type
										</h3>
										<p className="text-sm text-gray-700">
											{registration.entity_type}
										</p>
									</div>
									<div>
										<h3 className="py-1 text-xs font-light text-gray-500">
											Corporate officers
										</h3>
										<p className="text-sm text-gray-700">
											{registration?.people?.length > 0 ? (
												<ul>
													{registration?.people?.map((person, idx) => (
														<li key={idx}>{person}</li>
													))}
												</ul>
											) : (
												"N/A"
											)}
										</p>
									</div>
								</div>
							))}
						</>
					) : (
						<div className="-my-6 text-sm text-gray-900">
							No Secretary of State Filings found
						</div>
					)}
				</div>
			</section>

			{/* Known Addresses */}
			{addressVerificationReviewTask &&
				isNonEmptyArray(sortedAddressSources) && (
					<section className="container mx-auto">
						<div className="flex flex-col gap-8">
							<SectionHeader
								titleText="Known Addresses"
								badgeText={addressBadgeLabel}
								badgeType={addressBadgeType}
							/>

							{!addressIsVerified && (
								<p className="text-sm text-gray-600">
									{addressVerificationReviewTask.sublabel} —{" "}
									{addressVerificationReviewTask.message}
								</p>
							)}

							{registeredAgentReviewTask && (
								<p className="text-sm text-gray-600">
									{registeredAgentReviewTask.message}
								</p>
							)}

							{sortedAddressSources.map((address, index) => (
								<div
									key={address.id}
									className={cx(
										"grid grid-cols-1 sm:grid-cols-2 gap-4",
										index < sortedAddressSources.length - 1 &&
											"pb-4 border-b border-solid border-gray-100",
									)}
								>
									<div>
										<h3 className="py-1 text-xs font-light text-gray-500">
											Address retrieved
										</h3>
										<p className="text-sm text-gray-700 py-0.5">
											{address.full_address}
										</p>
									</div>
									<div>
										<h3 className="py-1 text-xs font-light text-gray-500">
											Deliverable
										</h3>
										<p className="text-sm text-gray-700 py-0.5">
											{address.deliverable ? "true" : "false"}
										</p>
									</div>
								</div>
							))}
						</div>
					</section>
				)}

			{/* Business Name(s) */}
			{businessNameReviewTask && isNonEmptyArray(businessNameMatches) && (
				<section className="container mx-auto">
					<div className="flex flex-col gap-8">
						<SectionHeader
							titleText="Business Name(s)"
							badgeText={businessNameBadgeLabel}
							badgeType={businessNameBadgeType}
						/>

						{!businessNameIsVerified && (
							<p className="text-sm text-gray-600">
								{businessNameReviewTask.message}
							</p>
						)}

						{businessNameMatches.map(({ name, submitted }, index) => (
							<div
								key={name + businessNameReviewTask.id}
								className={cx(
									"grid grid-cols-1 sm:grid-cols-2 gap-4",
									index < businessNameMatches.length - 1 &&
										"pb-4 border-b border-solid border-gray-100",
								)}
							>
								<div>
									<h3 className="py-1 text-xs font-light text-gray-500">
										Name retrieved
									</h3>
									<p className="text-sm text-gray-700 py-0.5">{name}</p>
								</div>
								<div>
									<h3 className="py-1 text-xs font-light text-gray-500">
										Submitted
									</h3>
									<p className="text-sm text-gray-700 py-0.5">
										{submitted ? "true" : "false"}
									</p>
								</div>
							</div>
						))}
					</div>
				</section>
			)}

			{/* Watchlist Summary */}
			{watchlistReviewTask && (
				<section className="container mx-auto">
					<div className="flex flex-col gap-8">
						<SectionHeader
							titleText="Watchlist Summary"
							badgeText={watchlistReviewTask.sublabel}
							badgeType={hasHits ? "warning" : "green_tick"}
						/>

						<h2 className="-mt-8 text-xs font-light leading-tight text-gray-400">
							14 Watchlists Searched
						</h2>

						{hasHits && (
							<p className="text-sm text-gray-600">
								{watchlistReviewTask.message}
							</p>
						)}

						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<div>
								<h3 className="py-1 text-xs font-light text-gray-500">
									Bureau of Industry and Security
								</h3>
								<WatchlistTitle
									title="Entity List"
									watchlistHits={watchlistHits}
								/>
								<WatchlistTitle
									title="Denied Persons List"
									watchlistHits={watchlistHits}
								/>
								<WatchlistTitle
									title="Military End User"
									watchlistHits={watchlistHits}
								/>
								<WatchlistTitle
									title="Unverified List"
									watchlistHits={watchlistHits}
								/>
							</div>

							<div>
								<h3 className="py-1 text-xs font-light text-gray-500">
									State Department
								</h3>
								<WatchlistTitle
									title="ITAR Debarred"
									watchlistHits={watchlistHits}
								/>
								<WatchlistTitle
									title="Nonproliferation Sanctions"
									watchlistHits={watchlistHits}
								/>
							</div>

							<div>
								<h3 className="py-1 text-xs font-light text-gray-500">
									Office of Foreign Assets Control
								</h3>
								<WatchlistTitle
									title="Capta List"
									watchlistHits={watchlistHits}
								/>
								<WatchlistTitle
									title="Foreign Sanctions Evaders"
									watchlistHits={watchlistHits}
								/>
								<WatchlistTitle
									title="Non-SDN Menu-Based Sanctions"
									watchlistHits={watchlistHits}
								/>
								<WatchlistTitle
									title="Non-SDN Iranian Sanctions"
									watchlistHits={watchlistHits}
								/>
								<WatchlistTitle
									title="Non-SDN Chinese Military-Industrial Complex Companies List"
									watchlistHits={watchlistHits}
								/>
								<WatchlistTitle
									title="Non-SDN Palestinian Legislative Council List"
									watchlistHits={watchlistHits}
								/>
								<WatchlistTitle
									title="Specially Designated Nationals"
									watchlistHits={watchlistHits}
								/>
								<WatchlistTitle
									title="Sectoral Sanctions Identifications List"
									watchlistHits={watchlistHits}
								/>
							</div>
						</div>
					</div>
				</section>
			)}
		</div>
	);
};

export default KnowYourBusiness;
