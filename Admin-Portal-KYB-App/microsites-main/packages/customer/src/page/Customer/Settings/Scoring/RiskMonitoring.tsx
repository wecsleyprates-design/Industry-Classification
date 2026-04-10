import React from "react";
import {
	type UseFormGetValues,
	type UseFormSetValue,
	type UseFormWatch,
} from "react-hook-form";
import { FlagIcon, NewspaperIcon } from "@heroicons/react/24/outline";
import { ArrowUpIcon } from "@heroicons/react/24/solid";
import Toggle from "@/components/Input/Toggle";
import { type IScoreRangesForm } from "@/types/riskAlerts";
import CreditScoreConfiguration from "./CreditScoreConfiguration";
import WorthScoreChange from "./WorthScoreChange";

interface Props {
	platform: "admin" | "customer";
	customerIntegrationSettingsData: any;
	riskConfigData: any;
	refetchRiskConfigHandler: () => Promise<void>;
	isLoading: boolean;

	setValue: UseFormSetValue<IScoreRangesForm>;
	getValues: UseFormGetValues<IScoreRangesForm>;
	watch: UseFormWatch<IScoreRangesForm>;
	customerId: string;
}

const RiskAlertRowSkeleton = () => (
	<div>
		<div className="justify-between my-6 sm:flex animate-pulse">
			<div className="flex items-start px-3 sm:px-4 mt-2">
				<div className="rounded-lg bg-gray-200 h-10 w-10 mr-4" />
				<div>
					<div className="h-4 w-48 bg-gray-200 rounded mb-2" />
					<div className="h-3 w-64 bg-gray-200 rounded mb-1" />
					<div className="h-3 w-40 bg-gray-200 rounded" />
				</div>
			</div>
			<div className="mt-4">
				<div className="h-6 w-12 bg-gray-200 rounded" />
			</div>
		</div>
	</div>
);

const RiskMonitoring: React.FC<Props> = ({
	platform,
	isLoading,
	getValues,
	setValue,
	customerIntegrationSettingsData,
	riskConfigData,
	refetchRiskConfigHandler,
	watch,
	customerId,
}) => {
	return (
		<div className="mt-6 pb-8 p-2 border rounded-2xl bg-white border-[#E5E7EB] mr-4">
			<div className="pb-2 pr-4 border-[#E5E7EB]">
				<div className="flex items-start justify-between my-4 py-b">
					<div className="px-3 sm:px-4 flex-1">
						<p className="font-semibold text-[#1F2937] text-base">
							Risk Alerts
						</p>
						<p className="text-gray-500 font-normal text-sm mt-2">
							Customize and define which type of risk alerts are enabled.{" "}
							{platform === "customer" ? (
								watch().riskAlertsStatus ? (
									<>To disable, please contact your CSM.</>
								) : (
									<>To enable, please contact your CSM.</>
								)
							) : (
								""
							)}
						</p>
					</div>
					<div
						className={`ml-4 mt-2 flex-shrink-0 ${
							platform === "customer" ? "opacity-50 pointer-events-none" : ""
						}`}
					>
						<Toggle
							disabled={platform === "customer"}
							value={getValues().riskAlertsStatus}
							onChange={() => {
								setValue("riskAlertsStatus", !getValues().riskAlertsStatus, {
									shouldDirty: true,
								});
							}}
						/>
					</div>
				</div>
			</div>

			{isLoading ? (
				<div className="pr-4">
					<RiskAlertRowSkeleton />
				</div>
			) : (
				watch().riskAlertsStatus && (
					<div className="px-2">
						<div className="pb-2">
							<div className="flex items-start justify-between px-4 sm:px-3 my-4">
								<div className="flex items-start gap-4 flex-1">
									<div className="text-red-600 rounded-lg bg-red-50 p-3 flex-shrink-0">
										<ArrowUpIcon className="w-5 h-5" />
									</div>
									<div>
										<p className="font-medium text-[#1F2937] text-sm">
											Movement to Higher Risk Tier
										</p>
										<p className="text-gray-500 font-normal text-sm mt-1">
											A score from a low risk tier to a medium risk tier
											triggers a medium risk alert. A score from a medium risk
											tier to a high risk tier triggers a high risk alert.
										</p>
									</div>
								</div>
								<div className="mt-4 flex-shrink-0">
									<Toggle
										value={getValues().scoreRiskTierTransitionStatus}
										onChange={() => {
											setValue(
												"scoreRiskTierTransitionStatus",
												!getValues().scoreRiskTierTransitionStatus,
												{ shouldDirty: true },
											);
										}}
									/>
								</div>
							</div>
						</div>

						{customerIntegrationSettingsData?.data?.settings?.adverse_media && (
							<div className="pb-2">
								<div className="flex items-start justify-between px-4 sm:px-3 my-4">
									<div className="flex items-start gap-4 flex-1">
										<div className="text-red-600 rounded-lg bg-red-50 p-3 flex-shrink-0">
											<NewspaperIcon className="w-5 h-5" />
										</div>
										<div>
											<p className="font-medium text-[#1F2937] text-sm">
												New Adverse Media
											</p>
											<p className="text-gray-500 font-normal text-sm mt-1">
												Trigger a medium risk alert when new adverse media is
												found for the company, control person, or any beneficial
												owners.
											</p>
										</div>
									</div>
									<div className="mt-4 flex-shrink-0">
										<Toggle
											value={getValues().newAdverseMediaStatus}
											onChange={() => {
												setValue(
													"newAdverseMediaStatus",
													!getValues().newAdverseMediaStatus,
													{ shouldDirty: true },
												);
											}}
										/>
									</div>
								</div>
							</div>
						)}

						<div className="pb-2">
							<div className="flex items-start justify-between px-4 sm:px-3 my-4">
								<div className="flex items-start gap-4 flex-1">
									<div className="text-red-600 rounded-lg bg-red-50 p-3 flex-shrink-0">
										<FlagIcon className="w-5 h-5" />
									</div>
									<div>
										<p className="font-medium text-[#1F2937] text-sm">
											New Bankruptcy, Lien, or Judgement
										</p>
										<p className="text-gray-500 font-normal text-sm mt-1">
											Trigger a high risk alert when there is a delta between a
											reported date, amount, status, or count.
										</p>
									</div>
								</div>
								<div className="mt-4 flex-shrink-0">
									<Toggle
										value={getValues().newBankruptcyLienJudgementStatus}
										onChange={() => {
											setValue(
												"newBankruptcyLienJudgementStatus",
												!getValues().newBankruptcyLienJudgementStatus,
												{ shouldDirty: true },
											);
										}}
									/>
								</div>
							</div>
						</div>

						<WorthScoreChange
							riskConfigData={riskConfigData}
							refetchRiskConfigHandler={refetchRiskConfigHandler}
							setValue={setValue}
							getValues={getValues}
							customerId={customerId}
						/>
						<CreditScoreConfiguration
							riskConfigData={riskConfigData}
							refetchRiskConfigHandler={refetchRiskConfigHandler}
							setValue={setValue}
							getValues={getValues}
							customerId={customerId}
						/>
					</div>
				)
			)}
		</div>
	);
};

export default RiskMonitoring;
