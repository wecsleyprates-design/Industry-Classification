import { useMemo, useState } from "react";
import {
	InformationCircleIcon,
	NewspaperIcon,
} from "@heroicons/react/24/outline";
import { twMerge } from "tailwind-merge";
import Badge from "@/components/Badge";
import TableLoader from "@/components/Spinner/TableLoader";
import { ReactCustomTooltip } from "@/components/Tooltip";
import {
	capitalize,
	convertToLocalDate,
	getRelevantArticles,
	truncateTitle,
} from "@/lib/helper";
import { getItem } from "@/lib/localStorage";
import { useGetCaseByIdQuery } from "@/services/queries/case.query";
import {
	useGetAdverseMedia,
	useGetAdverseMediaByBusinessId,
} from "@/services/queries/integration.query";
import type { MediaTypeGroup } from "@/types/case";
import type { AdverseMediaResponseDataArticle } from "@/types/publicRecords";

import { LOCALSTORAGE } from "@/constants/LocalStorage";

type Props = {
	caseId: string;
	businessId: string | null;
};

const AdverseMediaTab: React.FC<Props> = ({ caseId, businessId }) => {
	const [sectionFilters, setSectionFilters] = useState<Record<string, boolean>>(
		{},
	);

	// Get case data to access business name
	const [customerId] = useState<string>(getItem(LOCALSTORAGE.customerId) ?? "");
	const { data: caseData } = useGetCaseByIdQuery({
		customerId,
		caseId: caseId ?? "",
	});

	const { data: adverseMediaDataCase, isLoading: adverseMediaLoading } =
		useGetAdverseMedia(caseId ?? "");
	const {
		data: adverseMediaDataBusiness,
		isLoading: adverseMediaByBusinessLoading,
	} = useGetAdverseMediaByBusinessId(businessId ?? "");

	const adverseMediaData = useMemo(() => {
		if (adverseMediaDataCase) return adverseMediaDataCase;
		else return adverseMediaDataBusiness;
	}, [adverseMediaDataCase, adverseMediaDataBusiness]);

	const groupedArticles = useMemo(() => {
		const articles = adverseMediaData?.data?.articles ?? [];

		// Group articles by media type
		const grouped: Record<string, MediaTypeGroup> = {};

		articles.forEach((article) => {
			const mediaType = article.media_type || "business";
			if (!grouped[mediaType]) {
				grouped[mediaType] = {
					articles: [],
					allArticles: [],
					riskLevel: "LOW",
				};
			}
			grouped[mediaType].allArticles.push(article);
		});

		// Filter and determine risk levels for each media type
		Object.keys(grouped).forEach((mediaType) => {
			const allArticles = grouped[mediaType].allArticles;

			// Filter for relevant articles: high confidence (8+) AND medium to high risk
			const relevantArticles = getRelevantArticles(allArticles);

			// Determine the highest risk level for this media type
			const riskLevels = allArticles.map((a) => a.risk_level);
			const highestRisk = riskLevels.includes("HIGH")
				? "HIGH"
				: riskLevels.includes("MEDIUM")
					? "MEDIUM"
					: "LOW";

			// Use section-specific filter state, default to false (show relevant)
			const showAllForSection = sectionFilters[mediaType] || false;

			grouped[mediaType].articles = showAllForSection
				? allArticles
				: relevantArticles;
			grouped[mediaType].riskLevel = highestRisk;
		});

		return grouped;
	}, [adverseMediaData, sectionFilters]);

	const getSectionTitle = (mediaType: string) => {
		if (mediaType === "business") {
			return caseData?.data?.business?.name || "Business";
		}
		// Capitalize each word for individual names
		return mediaType
			.split(" ")
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(" ");
	};

	return (
		<>
			{(
				caseId
					? adverseMediaLoading
					: businessId
						? adverseMediaByBusinessLoading
						: false
			) ? (
				<div className="flex justify-center py-2 tracking-tight">
					<TableLoader />
				</div>
			) : JSON.stringify(adverseMediaData?.data) === "{}" ||
			  !adverseMediaData ? (
				<div className="py-4 sm:py-2 items-center justify-center flex flex-col min-h-[216px] border rounded-xl">
					<div className="flex items-center justify-center bg-gray-100 rounded-lg h-14 w-14">
						<NewspaperIcon
							className="w-8 h-8 text-gray-800"
							strokeWidth={1.5}
						/>
					</div>
					<span className="px-2 mt-4 font-medium text-gray-800 sm:px-0">
						No Adverse Media Found
					</span>
					<span className="text-sm text-gray-500 sm:w-[300px] mt-2 px-2 sm:px-0">
						When adverse media is found on the company, or its corporate
						officers, results will appear here.
					</span>
				</div>
			) : Object.keys(groupedArticles).length > 0 ? (
				// Sort media types: business first, then individual names alphabetically
				Object.keys(groupedArticles)
					.sort((a, b) => {
						if (a === "business") return -1;
						if (b === "business") return 1;
						return a.localeCompare(b);
					})
					.map((mediaType) => {
						const { articles, allArticles, riskLevel } =
							groupedArticles[mediaType];
						const sectionTitle = getSectionTitle(mediaType);
						const showAllForSection = sectionFilters[mediaType] || false;

						return (
							<div
								key={mediaType}
								className="w-full border border-gray-200 rounded-xl overflow-hidden"
							>
								{/* Section Header */}
								<div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-b border-gray-200">
									<div className="flex items-center gap-3">
										<h3 className="text-lg font-semibold text-gray-900">
											{sectionTitle}
										</h3>
										<Badge
											className={twMerge(
												"px-2 py-1 text-xs rounded-md",
												riskLevel === "HIGH"
													? "bg-red-100 text-red-700"
													: riskLevel === "MEDIUM"
														? "bg-yellow-100 text-yellow-700"
														: "bg-green-100 text-green-700",
											)}
											text={`${capitalize(
												riskLevel === "MEDIUM" ? "MODERATE" : riskLevel,
											)} Risk`}
										/>
									</div>
									{/* Filter Toggle - Top Right */}
									<div className="flex items-center gap-2">
										<button
											onClick={() => {
												setSectionFilters((prev) => ({
													...prev,
													[mediaType]: false,
												}));
											}}
											disabled={!showAllForSection}
											className={twMerge(
												"text-sm font-medium transition-colors",
												!showAllForSection
													? "text-blue-600 cursor-default"
													: "text-gray-500 hover:text-gray-700 cursor-pointer",
											)}
										>
											Relevant ({getRelevantArticles(allArticles).length})
										</button>
										<span className="text-gray-400">/</span>
										<button
											onClick={() => {
												setSectionFilters((prev) => ({
													...prev,
													[mediaType]: true,
												}));
											}}
											disabled={showAllForSection}
											className={twMerge(
												"text-sm font-medium transition-colors",
												showAllForSection
													? "text-blue-600 cursor-default"
													: "text-gray-500 hover:text-gray-700 cursor-pointer",
											)}
										>
											All ({allArticles.length})
										</button>
									</div>
								</div>

								{/* Articles List */}
								<div className="divide-y divide-gray-100">
									{articles.map(
										(
											article: AdverseMediaResponseDataArticle,
											index: number,
										) => {
											return (
												<div
													key={`${mediaType}-${index}`}
													className="px-6 py-5"
												>
													<a
														href={article.link}
														target="_blank"
														rel="noopener noreferrer"
														className="text-base font-medium text-blue-600 hover:underline"
													>
														{truncateTitle(article.title)}
													</a>
													<div className="mt-2 text-sm text-gray-500">
														{article.source}
														{" • "}
														{convertToLocalDate(article.date, "MM-DD-YYYY")}
													</div>
													<div className="mt-3 text-sm text-gray-600">
														{article.risk_description}
													</div>
													<div className="flex flex-row items-center gap-8 mt-4">
														<div className="">
															<div className="flex items-center gap-x-1.5">
																<span className="text-xs font-medium text-gray-500">
																	Match Score
																</span>
																<ReactCustomTooltip
																	id={"Score"}
																	tooltipStyle={{
																		backgroundColor: "#322F35",
																		paddingRight: "8px",
																		paddingLeft: "8px",
																		paddingTop: "4px",
																		paddingBottom: "4px",
																	}}
																	tooltip={
																		<div className="text-sm">
																			This score represents a scale that ranges
																			from 1-10 to reflect how confident this
																			media is related to the individual or
																			business. 1 reflects a low probability of
																			a match; 10 represents a perfect match.
																		</div>
																	}
																	noArrow
																	place="bottom"
																>
																	<InformationCircleIcon className="min-w-3.5 h-3.5 text-gray-500 rounded-md" />
																</ReactCustomTooltip>
															</div>
															{article.entity_focus_score ? (
																<Badge
																	className={twMerge(
																		"px-3 py-1 mt-1.5 bg-green-100 rounded-full",
																		article.entity_focus_score > 7
																			? "bg-green-100 text-green-700"
																			: article.entity_focus_score > 3
																				? "bg-yellow-100 text-yellow-700"
																				: article.entity_focus_score >= 0
																					? "bg-red-100 text-red-700"
																					: "bg-gray-100 text-black",
																	)}
																	text={String(article.entity_focus_score)}
																/>
															) : (
																<>-</>
															)}
														</div>
														<div className="">
															<div className="flex items-center gap-x-1.5">
																<span className="text-xs font-medium text-gray-500">
																	Risk
																</span>
																<ReactCustomTooltip
																	id={"Risk"}
																	tooltipStyle={{
																		backgroundColor: "#322F35",
																		paddingRight: "8px",
																		paddingLeft: "8px",
																		paddingTop: "4px",
																		paddingBottom: "4px",
																	}}
																	tooltip={
																		<div className="text-sm">
																			The risk level is generated based on a
																			number of variables that we believe may
																			have a material impact on the business.
																		</div>
																	}
																	noArrow
																	place="bottom"
																>
																	<InformationCircleIcon className="min-w-3.5 h-3.5 text-gray-500 rounded-md" />
																</ReactCustomTooltip>
															</div>
															{article.risk_level ? (
																<Badge
																	className={twMerge(
																		"px-2 py-1 mt-1.5 text-red-700 bg-red-100 rounded-md",
																		article.risk_level === "LOW"
																			? "bg-green-100 text-green-700"
																			: article.risk_level === "MEDIUM"
																				? "bg-yellow-100 text-yellow-700"
																				: article.risk_level === "HIGH"
																					? "bg-red-100 text-red-700"
																					: "bg-gray-100 text-black",
																	)}
																	text={
																		capitalize(
																			article.risk_level === "MEDIUM"
																				? "MODERATE"
																				: article.risk_level,
																		) + " Risk"
																	}
																/>
															) : (
																<>-</>
															)}
														</div>
													</div>
												</div>
											);
										},
									)}
								</div>
							</div>
						);
					})
			) : null}
		</>
	);
};

export default AdverseMediaTab;
