import { useState } from "react";
import { InformationCircleIcon } from "@heroicons/react/20/solid";
import { Skeleton } from "@/components/Skeleton";
import { useGetInsightsReport } from "@/services/queries/insights.query";
import { type Nullable } from "@/types/index";
import { FlyoutContent } from "./FlyoutContent";

const categoryDefinitions = {
	baseScore: {
		definition:
			"The base score represents the average score derived from the dataset used to train our predictive model. It serves as a benchmark against which individual business scores are compared. This score reflects the general creditworthiness and financial health of businesses within the dataset.",
		positiveImpact:
			"A base score higher than the benchmark indicates that the business performs better than the average within the dataset, positively influencing the overall worth score.",
		negativeImpact:
			"A base score lower than the benchmark suggests the business underperforms compared to the dataset average, potentially lowering the overall worth score.",
	},
	companyProfile: {
		definition:
			"The company profile score evaluates key attributes such as industry type, geographical location, and credit bureau information. This score reflects the business's market positioning and operational scale, including factors like revenue, entity type, number of locations, and employee count. It provides insight into how these elements contribute to the overall business worth.",
		positiveImpact:
			"A high company profile score, reflecting a strong market position, diverse revenue streams, and stable operational scale, enhances the overall worth score. This indicates a well-established and reputable business.",
		negativeImpact:
			"A low company profile score, which may result from operating in a high-risk industry or having limited market presence, can lower the worth score. This suggests higher risk and potential challenges in business operations.",
	},
	financialTrends: {
		definition:
			"Financial trends analyze changes in a company's financial performance and broader economic trends. This score considers factors such as revenue growth, profitability, and economic conditions that can impact financial stability. It helps identify patterns that may affect the business’s future financial health.",
		positiveImpact:
			"A high financial trends score, indicating positive revenue growth, strong profitability, and favorable economic conditions, enhances the overall worth score. This suggests financial stability and growth potential.",
		negativeImpact:
			"A low financial trends score, which may result from declining revenues, low profitability, or unfavorable economic conditions, can lower the worth score. This reflects potential financial instability and higher risk.",
	},
	publicRecords: {
		definition:
			"Public records encompass all publicly available information about a business, including social reviews, legal judgments, bankruptcies, and liens. This score assesses the impact of public perceptions and legal standings on the business’s creditworthiness. A thorough analysis of these records helps determine the overall risk profile.",
		positiveImpact:
			"Favorable public records, such as good social reviews and absence of bankruptcies, can enhance the overall worth score, indicating a low-risk and trustworthy business profile.",
		negativeImpact:
			"Negative public records, such as poor social reviews, outstanding judgments, or recent bankruptcies, can significantly lower the worth score. This reflects higher financial risk and potential instability, impacting the business’s perceived creditworthiness.",
	},
	liquidity: {
		definition:
			"Liquidity measures a business's ability to meet its short-term obligations using its available assets. This score evaluates cash flow management and access to liquid assets, which are crucial for sustaining daily operations and financial stability. High liquidity indicates strong financial health and operational efficiency.",
		positiveImpact:
			"A high liquidity score signifies robust cash flow and a strong ability to cover short-term debts, enhancing the overall worth score.",
		negativeImpact:
			"A low liquidity score might indicate potential cash flow issues, which could lower the worth score and suggest higher financial risk.",
	},
	worthScore: {
		definition:
			"The Worth Score aggregates real-time data from various sources, including public records, financial performance, and company profile attributes. It provides a comprehensive profile that reflects the overall health and stability of the business.",
		overallReflection:
			"The Worth Score combines data from various categories to give a holistic view of the business’s financial health, stability, and risk level.",
		decisionMaking:
			"A higher Worth Score suggests lower financial risk and higher creditworthiness, aiding in decision-making for loans, investments, and partnerships. Conversely, a lower Worth Score indicates higher risk, prompting further review and potential caution in business dealings.",
	},
};

export type FlyoutContentType =
	| "worth"
	| "companyProfile"
	| "financialTrends"
	| "publicRecords"
	| "liquidity";

const Insights = ({ caseId }: { caseId: string }) => {
	const [forceFlyoutContent, setForceFlyoutContent] =
		useState<Nullable<FlyoutContentType>>(null);

	const { data: insightsReport, isLoading: isLoadingInsightsReport } =
		useGetInsightsReport(caseId);

	return (
		<div className="bg-white">
			<div className="relative isolate bg-white py-4 shadow-md m-2">
				<div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8">
					<div className="mx-auto max-w-2xl lg:mx-0">
						<h1 className="text-lg font-semibold leading-8 tracking-tight text-[#6B66C4] mb-2">
							Insights Report
						</h1>
						{isLoadingInsightsReport ? (
							<div className="flex flex-col gap-2">
								<Skeleton className="rounded h-10 w-full" />
								<Skeleton className="rounded h-10 w-full" />
								<Skeleton className="rounded h-10 w-full" />
							</div>
						) : (
							<figure className="border-l border-[#6B66C4] pl-4">
								<p className="text-mg leading-6 text-gray-600">
									{insightsReport?.data.summary}
								</p>
							</figure>
						)}
					</div>
					<div className="mx-auto lg:mx-0 relative mt-8 max-w-2xl gap-y-16">
						<ul
							role="list"
							className="max-w-xl space-y-8 text-base leading-6 text-gray-600"
						>
							<li className="flex gap-x-3">
								<InformationCircleIcon
									className="mt-1 h-5 w-5 flex-none text-[#BC42B9]"
									aria-hidden="true"
									onMouseEnter={() => {
										setForceFlyoutContent("worth");
									}}
									onMouseLeave={() => {
										setForceFlyoutContent(null);
									}}
								/>
								<div>
									<FlyoutContent
										title="Worth score"
										definition={categoryDefinitions.worthScore.definition}
										subCopyHeader1="Overall reflection"
										subCopy1={categoryDefinitions.worthScore.overallReflection}
										subCopyHeader2="Decision making"
										subCopy2={categoryDefinitions.worthScore.decisionMaking}
										forceOpen={forceFlyoutContent === "worth"}
									>
										<strong className="font-semibold text-gray-900">
											Worth score.
										</strong>
									</FlyoutContent>
									{isLoadingInsightsReport ? (
										<div className="mt-2 flex flex-col gap-2">
											<Skeleton className="rounded h-8 w-96" />
											<Skeleton className="rounded h-8 w-96" />
										</div>
									) : (
										<span className="text-sm">
											{insightsReport?.data.reportBreakDown.impactOfWorthScore}
										</span>
									)}
								</div>
							</li>
							<li className="flex gap-x-3">
								<InformationCircleIcon
									className="mt-1 h-5 w-5 flex-none text-[#BC42B9]"
									aria-hidden="true"
									onMouseEnter={() => {
										setForceFlyoutContent("companyProfile");
									}}
									onMouseLeave={() => {
										setForceFlyoutContent(null);
									}}
								/>
								<div>
									<FlyoutContent
										title="Company profile"
										definition={categoryDefinitions.companyProfile.definition}
										subCopyHeader1="Positive impact"
										subCopy1={categoryDefinitions.companyProfile.positiveImpact}
										subCopyHeader2="Negative impact"
										subCopy2={categoryDefinitions.companyProfile.negativeImpact}
										forceOpen={forceFlyoutContent === "companyProfile"}
									>
										<strong className="font-semibold text-gray-900">
											Company profile.
										</strong>
									</FlyoutContent>
									{isLoadingInsightsReport ? (
										<div className="mt-2 flex flex-col gap-2">
											<Skeleton className="rounded h-8 w-96" />
											<Skeleton className="rounded h-8 w-96" />
										</div>
									) : (
										<span className="text-sm">
											{
												insightsReport?.data.reportBreakDown
													.impactOfCompanyProfileScore
											}
										</span>
									)}
								</div>
							</li>
							<li className="flex gap-x-3">
								<InformationCircleIcon
									className="mt-1 h-5 w-5 flex-none text-[#BC42B9]"
									aria-hidden="true"
									onMouseEnter={() => {
										setForceFlyoutContent("financialTrends");
									}}
									onMouseLeave={() => {
										setForceFlyoutContent(null);
									}}
								/>
								<div>
									<FlyoutContent
										title="Financial trends"
										definition={categoryDefinitions.financialTrends.definition}
										subCopyHeader1="Positive impact"
										subCopy1={
											categoryDefinitions.financialTrends.positiveImpact
										}
										subCopyHeader2="Negative impact"
										subCopy2={
											categoryDefinitions.financialTrends.negativeImpact
										}
										forceOpen={forceFlyoutContent === "financialTrends"}
									>
										<strong className="font-semibold text-gray-900">
											Financial trends.
										</strong>
									</FlyoutContent>
									{isLoadingInsightsReport ? (
										<div className="mt-2 flex flex-col gap-2">
											<Skeleton className="rounded h-8 w-96" />
											<Skeleton className="rounded h-8 w-96" />
										</div>
									) : (
										<span className="text-sm">
											{
												insightsReport?.data.reportBreakDown
													.impactOfFinancialTrendsScore
											}
										</span>
									)}
								</div>
							</li>
							<li className="flex gap-x-3">
								<InformationCircleIcon
									className="mt-1 h-5 w-5 flex-none text-[#BC42B9]"
									aria-hidden="true"
									onMouseEnter={() => {
										setForceFlyoutContent("publicRecords");
									}}
									onMouseLeave={() => {
										setForceFlyoutContent(null);
									}}
								/>
								<div>
									<FlyoutContent
										title="Public records"
										definition={categoryDefinitions.publicRecords.definition}
										subCopyHeader1="Positive impact"
										subCopy1={categoryDefinitions.publicRecords.positiveImpact}
										subCopyHeader2="Negative impact"
										subCopy2={categoryDefinitions.publicRecords.negativeImpact}
										forceOpen={forceFlyoutContent === "publicRecords"}
									>
										<strong className="font-semibold text-gray-900">
											Public records.
										</strong>
									</FlyoutContent>
									{isLoadingInsightsReport ? (
										<div className="mt-2 flex flex-col gap-2">
											<Skeleton className="rounded h-8 w-96" />
											<Skeleton className="rounded h-8 w-96" />
										</div>
									) : (
										<span className="text-sm">
											{
												insightsReport?.data.reportBreakDown
													.impactOfPublicRecordsScore
											}
										</span>
									)}
								</div>
							</li>
						</ul>
					</div>
				</div>
			</div>
		</div>
	);
};

export default Insights;
