import React, { useEffect } from "react";
import { isNonEmptyArray } from "@austinburns/type-guards";
import {
	ArrowDownTrayIcon,
	ArrowTopRightOnSquareIcon,
	DocumentTextIcon,
	InformationCircleIcon,
} from "@heroicons/react/24/outline";
import cx from "classnames";
import { useFlags } from "launchdarkly-react-client-sdk";
import { twMerge } from "tailwind-merge";
import ConditionalPlusIcon from "@/assets/ConditionalPlusIcon";
import StatusBadge from "@/components/Badge/StatusBadge";
import useCustomToast from "@/hooks/useCustomToast";
import { capitalize, convertToLocalDate } from "@/lib/helper";
import { getTaxIdLabel } from "@/lib/taxIdLabels";
import { downloadVerificationUpload } from "@/services/api/integration.service";
import {
	useGetExtractedVerificationUploads,
	useGetFactsKyb,
	useGetIndividualWatchlistDetails,
	useSubmitBusinessVerificationOrder,
} from "@/services/queries/integration.query";
import {
	type AddressDeliverableFormat,
	type PeopleObjectValue,
	type PeopleObjectValueSource,
} from "@/types/integrations";
import RelatedBusinessesKYB from "./RelatedBusinesses";
import { HitCard, SectionHeader } from "./SectionHeader";
import { SkeletonUI } from "./SkeletonUI";
import { WatchlistTitle } from "./WatchlistTitleNew";

import FEATURE_FLAGES from "@/constants/FeatureFlags";
import { GuestOwnerStyle } from "@/constants/TailwindStyles";

// countries I want to exclude verification badges
// TODO: We want to make it dynamic
const excludedCountriesForVerification = ["CA", "CAN", "CANADA"];

const isDirectBusinessLink = ({ url }: { url: string }): boolean => {
	// Match common entity identifiers OR numeric IDs in query string or path
	const entityPattern =
		/(org=|corp=|businessID=|businessId=|p_corpid=|ID=|acct-number=|entityId=|CharterID=|filingGuid=|eFNum=|fileNumber=)/i;
	if (entityPattern.test(url)) return true;

	// Fallback: Check if URL ends with or contains a long numeric/alphanumeric ID (not just a page number)
	const idLikePattern = /[?&/=][A-Za-z0-9]*\d{4,}[A-Za-z0-9]*/;
	return idLikePattern.test(url);
};

const KnowYourBusiness = ({
	businessId,
	countryCode,
}: {
	businessId: string | null;
	countryCode?: string | undefined;
}) => {
	const featureFlags = useFlags();
	const showBadge = !excludedCountriesForVerification.includes(
		countryCode ?? "",
	);
	const hideSection = excludedCountriesForVerification.includes(
		countryCode ?? "",
	);
	// New API
	const { data: kybFactsData, isLoading: kybFactsDataLoading } = useGetFactsKyb(
		businessId ?? "",
	);

	const { data: verificationUploadsData } = useGetExtractedVerificationUploads(
		businessId ?? "",
	);

	const { data: individualWatchListHits } = useGetIndividualWatchlistDetails(
		businessId ?? "",
	);

	const { successHandler, errorHandler } = useCustomToast();

	// Function to compare the addresses and create the result
	const addressesDeliverable = (
		addresses: string[] | undefined,
		deliverableAddresses: string[] | undefined,
	) => {
		if (!addresses) return [];
		const result: AddressDeliverableFormat[] = [];

		const deliverableSet = new Set(deliverableAddresses);

		addresses?.forEach((address) => {
			if (deliverableSet.has(address)) {
				result.push({ full_address: address, deliverable: true });
			} else {
				result.push({ full_address: address, deliverable: false });
			}
		});

		return result;
	};

	const deliverableAddressList: AddressDeliverableFormat[] =
		addressesDeliverable(
			kybFactsData?.data?.addresses?.value,
			kybFactsData?.data?.addresses_deliverable?.value,
		);

	const {
		error: submitBusinessVerificationOrderError,
		isSuccess: submitBusinessVerificationOrderSuccess,
	} = useSubmitBusinessVerificationOrder(businessId ?? "");

	useEffect(() => {
		if (submitBusinessVerificationOrderSuccess) {
			successHandler({
				message: "Business verification order submitted successfully",
			});
		}
	}, [submitBusinessVerificationOrderSuccess]);

	useEffect(() => {
		if (submitBusinessVerificationOrderError)
			errorHandler(submitBusinessVerificationOrderError);
	}, [submitBusinessVerificationOrderError]);

	if (kybFactsDataLoading) return <SkeletonUI countryCode={countryCode} />;

	return (
		<div>
			<div className="flex flex-col gap-10 pt-2">
				<section className="container mx-auto">
					<div className="flex flex-col gap-4">
						<SectionHeader
							titleText={getTaxIdLabel(countryCode, "sectionTitle")}
							{...(showBadge && {
								badgeText:
									kybFactsData?.data?.tin_match?.value?.status === "success"
										? "Verified"
										: kybFactsData?.data?.tin_match?.value?.status === "failure"
											? "Not Found"
											: capitalize(
													kybFactsData?.data?.tin_match?.value
														?.status as string,
												),
								badgeType:
									kybFactsData?.data?.tin_match?.value?.status === "success"
										? "green_tick"
										: "red_exclamation_circle",
							})}
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
														businessId ?? "",
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

						{/* Tin message not received */}
						{kybFactsData?.data?.tin_match?.value?.status !== "success" && (
							<p className="text-sm text-gray-600">
								{kybFactsData?.data?.tin_match?.value?.message}
							</p>
						)}

						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<div>
								<h3 className="py-1 text-xs font-light text-gray-500">
									Business name
								</h3>
								<p
									className={twMerge(
										"text-sm text-gray-700",
										kybFactsData?.data?.guest_owner_edits?.includes("name") &&
											GuestOwnerStyle,
									)}
								>
									{kybFactsData?.data?.legal_name?.value ?? ""}
									<ConditionalPlusIcon
										isNotapplicant={
											kybFactsData?.data?.guest_owner_edits?.includes("name") ??
											false
										}
									/>
								</p>
							</div>
							<div>
								<h3 className="py-1 text-xs font-light text-gray-500">
									{getTaxIdLabel(countryCode, "fieldLabel")}
								</h3>
								<p
									className={twMerge(
										"text-sm text-gray-700",
										kybFactsData?.data?.guest_owner_edits?.includes("tin") &&
											GuestOwnerStyle,
									)}
								>
									{kybFactsData?.data?.tin?.value ?? ""}
									<ConditionalPlusIcon
										isNotapplicant={
											kybFactsData?.data?.guest_owner_edits?.includes("tin") ??
											false
										}
									/>
								</p>
							</div>
						</div>
					</div>
				</section>

				{/* Secretary of State Filings */}
				<section className="container mx-auto">
					<div className="flex flex-col gap-8">
						<SectionHeader
							titleText="Secretary of State Filings"
							{...(showBadge && { sosBadgeData: kybFactsData?.data })}
						/>
						{isNonEmptyArray(kybFactsData?.data?.sos_filings?.value) ? (
							<>
								{kybFactsData?.data?.sos_filings?.value?.map((sos, index) => (
									<div
										key={`sos-filing-${index}`}
										className={twMerge(
											"grid grid-cols-1 sm:grid-cols-3 gap-4",
											index <
												(kybFactsData?.data?.sos_filings?.value?.length ?? 0) -
													1 && "pb-4 border-b border-solid border-gray-100",
										)}
									>
										<div>
											<h3 className="py-1 text-xs font-light text-gray-500">
												Legal Entity Name
											</h3>
											<p className="text-sm text-gray-700">{sos.filing_name}</p>
										</div>
										<div>
											<h3 className="py-1 text-xs font-light text-gray-500">
												Registration Date
											</h3>
											<p className="text-sm text-gray-700">
												{sos.filing_date
													? convertToLocalDate(
															new Date(sos.filing_date),
															"MM-DD-YYYY",
														)
													: "N/A"}
											</p>
										</div>
										<div>
											<h3 className="py-1 text-xs font-light text-gray-500">
												Status
											</h3>
											<p className="text-sm text-gray-700">
												{sos.active != null
													? capitalize(sos.active ? "Active" : "Inactive")
													: "N/A"}
											</p>
										</div>
										<div>
											<h3 className="py-1 text-xs font-light text-gray-500">
												Entity Type
											</h3>
											<p className="text-sm text-gray-700">
												{sos.entity_type || "N/A"}
											</p>
										</div>
										<div>
											<h3 className="py-1 text-xs font-light text-gray-500">
												State
											</h3>
											<p className="text-sm text-gray-700">
												{sos.state || "N/A"}
											</p>
										</div>
										<div>
											<h3 className="py-1 text-xs font-light text-gray-500">
												Articles of Incorporation
											</h3>
											{sos?.url && isDirectBusinessLink({ url: sos.url }) ? (
												<a
													href={sos.url}
													target="_blank"
													rel="noopener noreferrer"
													className="flex items-center text-sm text-blue-600"
												>
													<>
														Open Link
														<ArrowTopRightOnSquareIcon className="w-4 h-4 ml-1" />
													</>
												</a>
											) : (
												<span className="text-sm">N/A</span>
											)}
										</div>

										{/* Corporate Officers Section */}
										<div>
											<h3 className="py-1 text-xs font-light text-gray-500">
												Corporate Officers
											</h3>
											<div className="text-sm text-gray-700">
												{(() => {
													const officers = kybFactsData?.data?.people?.value
														?.filter((person: PeopleObjectValue) =>
															person?.source?.some(
																(src: PeopleObjectValueSource | string) =>
																	typeof src === "string"
																		? src === sos.id
																		: src?.id === sos.id,
															),
														)
														.flatMap((person: any) =>
															person.titles?.map((title: string) => ({
																name: person.name,
																title,
															})),
														);

													if (officers && officers?.length > 0) {
														return officers.map((officer, index) => (
															<p
																key={`${String(officer.name)}-${String(
																	officer.title,
																)}-${index}`}
															>
																{capitalize(officer.name)} -{" "}
																{capitalize(officer.title)}
															</p>
														));
													} else {
														return <p>N/A</p>;
													}
												})()}
											</div>
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
				{kybFactsData?.data?.addresses?.value?.length ? (
					<section className="container mx-auto">
						<div className="flex flex-col gap-8">
							<SectionHeader
								titleText="Known Addresses"
								{...(showBadge && {
									badgeText:
										kybFactsData?.data?.address_verification_boolean?.value ||
										kybFactsData?.data?.address_match_boolean?.value
											? "Verified"
											: kybFactsData?.data?.address_match?.value ===
														"warning" ||
												  kybFactsData?.data?.address_registered_agent?.value
														?.status === "warning"
												? "Warning"
												: "Failure",
									badgeType:
										kybFactsData?.data?.address_verification_boolean?.value ||
										kybFactsData?.data?.address_match_boolean?.value
											? "green_tick"
											: kybFactsData?.data?.address_match?.value ===
														"warning" ||
												  kybFactsData?.data?.address_registered_agent?.value
														?.status === "warning"
												? "warning"
												: "red_exclamation_circle",
								})}
							/>
							{/* Address not verified message, sublabel and registered agent message not being received */}
							{showBadge &&
								kybFactsData?.data?.address_verification?.value?.sublabel && (
									<p className="text-sm text-gray-600">
										{capitalize(
											kybFactsData?.data?.address_verification?.value
												?.sublabel ?? "",
										)}{" "}
										— {kybFactsData?.data?.address_verification?.value?.message}
									</p>
								)}

							{kybFactsData?.data?.address_registered_agent?.value?.status !==
								"success" && (
								<p className="text-sm text-gray-600">
									{kybFactsData?.data?.address_registered_agent?.value?.message}
								</p>
							)}

							{deliverableAddressList?.map((address, index) => (
								<div
									key={address.full_address}
									className={twMerge(
										"grid grid-cols-1 sm:grid-cols-2 gap-4",
										index < deliverableAddressList?.length - 1 &&
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
											{address.deliverable ? "True" : "False"}
										</p>
									</div>
								</div>
							))}
						</div>
					</section>
				) : null}

				{/* Business Name(s)  */}
				{kybFactsData?.data?.names_submitted?.value?.length ? (
					<section className="container mx-auto">
						<div className="flex flex-col gap-8">
							<SectionHeader
								titleText="Business Name(s)"
								{...(showBadge && {
									badgeText: kybFactsData?.data?.name_match_boolean?.value
										? "Verified"
										: kybFactsData?.data?.name_match?.value?.status ===
											  "warning"
											? capitalize(
													kybFactsData?.data?.name_match?.value?.sublabel,
												)
											: "Failure",
									badgeType: kybFactsData?.data?.name_match_boolean?.value
										? "green_tick"
										: kybFactsData?.data?.name_match?.value?.status ===
											  "warning"
											? "gray_exclamation_circle"
											: "red_exclamation_circle",
								})}
							/>

							{!kybFactsData?.data?.name_match_boolean?.value && (
								<p className="text-sm text-gray-600">
									{kybFactsData?.data?.name_match?.value?.message}
								</p>
							)}

							{kybFactsData?.data?.names_submitted.value?.map(
								(name: any, index: any) => (
									<div
										key={name.business_entity_verification_id}
										className={cx(
											"grid grid-cols-1 sm:grid-cols-2 gap-4",
											index <
												(kybFactsData?.data?.names_submitted.value?.length ??
													0) -
													1 && "pb-4 border-b border-solid border-gray-100",
										)}
									>
										<div>
											<h3 className="py-1 text-xs font-light text-gray-500">
												Name retrieved
											</h3>
											<p className="text-sm text-gray-700 py-0.5">
												{name?.name}
											</p>
										</div>
										<div>
											<h3 className="py-1 text-xs font-light text-gray-500">
												Submitted
											</h3>
											<p className="text-sm text-gray-700 py-0.5">
												{name.submitted ? "True" : "False"}
											</p>
										</div>
									</div>
								),
							)}
						</div>
					</section>
				) : null}

				<RelatedBusinessesKYB businessId={businessId ?? ""} />

				{!hideSection && (
					<>
						{/* Watchlist Summary */}
						<section className="container mx-auto">
							<div className="flex flex-col gap-8">
								<SectionHeader
									titleText="Watchlists Scanned"
									badgeText={
										kybFactsData?.data?.watchlist?.value?.metadata?.length
											? `${
													kybFactsData?.data?.watchlist?.value?.metadata?.length
												} Hit${
													kybFactsData?.data?.watchlist?.value?.metadata
														?.length > 1
														? "s"
														: ""
												} Found`
											: "No Hits"
									}
									badgeType={
										kybFactsData?.data?.watchlist?.value?.metadata?.length
											? "red_exclamation_circle"
											: "green_tick"
									}
								/>

								<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
									<div>
										<h3 className="py-1 text-xs font-light text-gray-500">
											Bureau of Industry and Security
										</h3>
										<WatchlistTitle
											title="Entity List"
											watchlistHits={
												kybFactsData?.data?.watchlist?.value?.metadata
											}
										/>

										<WatchlistTitle
											title="Denied Persons List"
											watchlistHits={
												kybFactsData?.data?.watchlist?.value?.metadata
											}
										/>
										<WatchlistTitle
											title="Military End User"
											watchlistHits={
												kybFactsData?.data?.watchlist?.value?.metadata
											}
										/>
										<WatchlistTitle
											title="Unverified List"
											watchlistHits={
												kybFactsData?.data?.watchlist?.value?.metadata
											}
										/>
									</div>

									<div>
										<h3 className="py-1 text-xs font-light text-gray-500">
											State Department
										</h3>
										<WatchlistTitle
											title="ITAR Debarred"
											watchlistHits={
												kybFactsData?.data?.watchlist?.value?.metadata
											}
										/>
										<WatchlistTitle
											title="Nonproliferation Sanctions"
											watchlistHits={
												kybFactsData?.data?.watchlist?.value?.metadata
											}
										/>
									</div>

									<div>
										<h3 className="py-1 text-xs font-light text-gray-500">
											Office of Foreign Assets Control
										</h3>
										<WatchlistTitle
											title="Capta List"
											watchlistHits={
												kybFactsData?.data?.watchlist?.value?.metadata
											}
										/>
										<WatchlistTitle
											title="Foreign Sanctions Evaders"
											watchlistHits={
												kybFactsData?.data?.watchlist?.value?.metadata
											}
										/>
										<WatchlistTitle
											title="Non-SDN Menu-Based Sanctions"
											watchlistHits={
												kybFactsData?.data?.watchlist?.value?.metadata
											}
										/>
										<WatchlistTitle
											title="Non-SDN Iranian Sanctions"
											watchlistHits={
												kybFactsData?.data?.watchlist?.value?.metadata
											}
										/>
										<WatchlistTitle
											title="Non-SDN Chinese Military-Industrial Complex Companies List"
											watchlistHits={
												kybFactsData?.data?.watchlist?.value?.metadata
											}
										/>
										<WatchlistTitle
											title="Non-SDN Palestinian Legislative Council List"
											watchlistHits={
												kybFactsData?.data?.watchlist?.value?.metadata
											}
										/>
										<WatchlistTitle
											title="Specially Designated Nationals"
											watchlistHits={
												kybFactsData?.data?.watchlist?.value?.metadata
											}
										/>
										<WatchlistTitle
											title="Sectoral Sanctions Identifications List"
											watchlistHits={
												kybFactsData?.data?.watchlist?.value?.metadata
											}
										/>
									</div>
								</div>
							</div>
						</section>
						{/* Watchlist Individual Hits */}
						<div className="container flex flex-col gap-8 mx-auto">
							{individualWatchListHits?.data.records.map((hit, index) => (
								<section key={index}>
									<SectionHeader
										titleText={`Hits for ${hit.name}`}
										badgeText={`${hit.watchlist_results.length} Hit${
											hit.watchlist_results.length > 1 ? "s" : ""
										} Found`}
										badgeType={"red_exclamation_circle"}
									/>
									<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
										{hit.watchlist_results.map((result, index) => (
											<HitCard
												agency={result.metadata.agency}
												country={result.list_country}
												hitNumber={index + 1}
												sourceLink={result.url}
												title={result.metadata.title}
												key={index}
											/>
										))}
									</div>
								</section>
							))}
						</div>
					</>
				)}
			</div>
			{featureFlags[FEATURE_FLAGES?.PAT_466_TRIGGERING_APPLICATION_EDIT] &&
				(kybFactsData?.data?.guest_owner_edits?.includes("tin") ||
					kybFactsData?.data?.guest_owner_edits?.includes("name")) && (
					<div className="flex flex-row p-4 font-normal tracking-tight font-inter">
						<div className="flex items-center justify-center h-10 text-sm bg-blue-50 min-w-10">
							†
						</div>
						<div className="ml-4 text-xs ">
							Denotes fields that were filled out internally. These fields are
							only visible to applicants on documents that required an
							e-signature and have been mapped accordingly. For additional
							information, please reach out to your Worth representative.
						</div>
					</div>
				)}
		</div>
	);
};

export default KnowYourBusiness;
