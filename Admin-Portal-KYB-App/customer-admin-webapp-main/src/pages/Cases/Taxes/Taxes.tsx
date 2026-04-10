import { useEffect, useState } from "react";
import { ArrowDownTrayIcon, DocumentIcon } from "@heroicons/react/24/outline";
import { useFlags } from "launchdarkly-react-client-sdk";
import { twMerge } from "tailwind-merge";
import ConditionalPlusIcon from "@/assets/ConditionalPlusIcon";
import { TitleLeftDivider } from "@/components/Dividers";
import TableLoader from "@/components/Spinner/TableLoader";
import useCustomToast from "@/hooks/useCustomToast";
import { convertToLocalDate, formatPrice } from "@/lib/helper";
import { downloadOcrDocumentUpload } from "@/services/api/integration.service";
import { useGetTaxStatus } from "@/services/queries/integration.query";
import { type AnnualData, type QuarterlyData } from "@/types/taxes";

import FEATURE_FLAGES from "@/constants/FeatureFlags";
import { GuestOwnerStyle } from "@/constants/TailwindStyles";

type Props = {
	businessId: string;
	caseId?: string;
	scoreTriggerId?: string;
};

const Taxes = ({ businessId, caseId, scoreTriggerId }: Props) => {
	const featureFlags = useFlags();

	const { successHandler, errorHandler } = useCustomToast();

	const { data: taxStatus, isLoading: isTaxStatusLoading } = useGetTaxStatus({
		businessId,
		caseId,
		scoreTriggerId,
	});

	const [documents, setDocuments] = useState<
		Record<string, Array<{ file_name: string; file_path: string }>>
	>({});

	useEffect(() => {
		taxStatus?.data?.annual_data?.forEach((data) => {
			if (data?.metadata?.ocr_document?.length) {
				setDocuments((prev) => ({
					...prev,
					[data.period]: data.metadata.ocr_document,
				}));
			}
		});
	}, [taxStatus]);

	const DownloadDocument = ({ documentYear }: { documentYear: string }) => (
		<div className="mt-8">
			<h3 className="mb-2 text-gray-500 text-md">Documents</h3>
			{documents[documentYear]?.map((document) => (
				<button
					key={document.file_path}
					className={twMerge(
						"inline-flex items-center text-blue-600 cursor-pointer hover:text-blue-800",
						taxStatus?.data?.guest_owner_edits?.includes("file_name") &&
							GuestOwnerStyle,
					)}
					onClick={async () => {
						try {
							await downloadOcrDocumentUpload(
								businessId,
								document.file_path,
								document.file_name,
							);
							successHandler({
								message: `Document downloaded successfully`,
							});
						} catch (error) {
							errorHandler({ message: "Error downloading file" });
						}
					}}
				>
					<span>{document.file_name}</span>
					<ConditionalPlusIcon
						isNotapplicant={
							!!taxStatus?.data?.guest_owner_edits?.includes("file_name")
						}
					/>
					<svg
						className="w-4 h-4 ml-2"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
						/>
					</svg>
				</button>
			)) ?? "-"}
		</div>
	);

	return (
		<div>
			{isTaxStatusLoading ? (
				<div
					style={{ display: "flex", justifyContent: "center" }}
					className="py-2 text-base font-normal tracking-tight text-center text-gray-500"
				>
					<TableLoader />
				</div>
			) : (
				<>
					{taxStatus?.data?.consent_file?.signedRequest ? (
						<div className="p-4 pt-0 pl-2 gap-x-4">
							<p className="py-2 text-xs font-normal tracking-tight text-gray-500 break-words ">
								Document
							</p>

							<div className="flex items-center justify-start h-16 px-3 py-4 border border-gray-300 rounded-md gap-x-3">
								<div className="flex items-center justify-center h-10 bg-gray-100 rounded-full min-w-10">
									<DocumentIcon height={20} />
								</div>
								<div className="flex-1 text-sm font-medium truncate text-ellipsis">
									{String(taxStatus?.data?.consent_file?.fileName)}
								</div>
								<div className="ml-auto">
									<a
										target="_blank"
										rel="noopener noreferrer"
										href={taxStatus?.data?.consent_file?.signedRequest}
										className="flex items-center justify-center h-10 rounded-full cursor-pointer min-w-10 hover:bg-blue-50"
									>
										<ArrowDownTrayIcon height={20} className="text-blue-600" />
									</a>
								</div>
							</div>
						</div>
					) : null}
					{taxStatus?.data?.annual_data?.length ? (
						taxStatus?.data.annual_data?.map(
							(tax: AnnualData, index: number) => (
								<div key={index}>
									<div className="py-2">
										<TitleLeftDivider
											text={`Tax filing year ${String(tax?.period || "")} `}
										></TitleLeftDivider>
										<div className="text-xs pl-2.5">Tax Return: Form 1120</div>
									</div>

									<div className="container mx-auto">
										<div className="grid grid-cols-1 gap-6 pl-3 sm:grid-cols-2 md:grid-cols-3">
											<div>
												<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
													Total sales
												</p>
												<p
													className={twMerge(
														"py-2 text-sm font-medium tracking-tight break-words text-slate-800",
														taxStatus?.data?.guest_owner_edits?.includes(
															"total_sales",
														) && GuestOwnerStyle,
													)}
												>
													{formatPrice(tax?.total_sales) ?? ""}
													<ConditionalPlusIcon
														isNotapplicant={taxStatus?.data?.guest_owner_edits?.includes(
															"total_sales",
														)}
													/>
												</p>
											</div>
											<div>
												<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
													Total compensation
												</p>
												<p
													className={twMerge(
														"py-2 text-sm font-medium tracking-tight break-words text-slate-800",
														taxStatus?.data?.guest_owner_edits?.includes(
															"total_compensation",
														) && GuestOwnerStyle,
													)}
												>
													{formatPrice(tax?.total_compensation) ?? ""}
													<ConditionalPlusIcon
														isNotapplicant={taxStatus?.data?.guest_owner_edits?.includes(
															"total_compensation",
														)}
													/>
												</p>
											</div>
											<div>
												<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
													Total wages
												</p>
												<p
													className={twMerge(
														"py-2 text-sm font-medium tracking-tight break-words text-slate-800",
														taxStatus?.data?.guest_owner_edits?.includes(
															"total_wages",
														) && GuestOwnerStyle,
													)}
												>
													{formatPrice(tax?.total_wages) ?? ""}
													<ConditionalPlusIcon
														isNotapplicant={taxStatus?.data?.guest_owner_edits?.includes(
															"total_wages",
														)}
													/>
												</p>
											</div>
											<div>
												<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
													Cost of goods sold
												</p>
												<p
													className={twMerge(
														"py-2 text-sm font-medium tracking-tight break-words text-slate-800",
														taxStatus?.data?.guest_owner_edits?.includes(
															"cost_of_goods_sold",
														) && GuestOwnerStyle,
													)}
												>
													{formatPrice(tax?.cost_of_goods_sold) ?? ""}
													<ConditionalPlusIcon
														isNotapplicant={taxStatus?.data?.guest_owner_edits?.includes(
															"cost_of_goods_sold",
														)}
													/>
												</p>
											</div>
											<div>
												<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
													IRS balance
												</p>
												<p
													className={twMerge(
														"py-2 text-sm font-medium tracking-tight break-words text-slate-800",
														taxStatus?.data?.guest_owner_edits?.includes(
															"irs_balance",
														) && GuestOwnerStyle,
													)}
												>
													{formatPrice(tax?.irs_balance) ?? ""}
													<ConditionalPlusIcon
														isNotapplicant={taxStatus?.data?.guest_owner_edits?.includes(
															"irs_balance",
														)}
													/>
												</p>
											</div>
											<div>
												<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
													IRS liens
												</p>
												<p
													className={twMerge(
														"py-2 text-sm font-medium tracking-tight break-words text-slate-800",
														taxStatus?.data?.guest_owner_edits?.includes(
															"lien_balance",
														) && GuestOwnerStyle,
													)}
												>
													{formatPrice(tax?.lien_balance) ?? ""}
													<ConditionalPlusIcon
														isNotapplicant={taxStatus?.data?.guest_owner_edits?.includes(
															"lien_balance",
														)}
													/>
												</p>
											</div>
											<div className="col-span-1 sm:col-span-2 md:col-span-3">
												{tax.quarterlyData?.map(
													(quarterlyData: QuarterlyData, index: number) => (
														<div
															key={index}
															className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 "
														>
															<div className="col-span-1 py-2 text-xs font-normal tracking-tight sm:col-span-2 md:col-span-3">
																Employer’s Quarterly Federal Tax Return: Form
																941
															</div>
															<div>
																<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
																	Tax Period Ending
																</p>
																<p
																	className={twMerge(
																		"py-2 text-sm font-medium tracking-tight break-words text-slate-800",
																		taxStatus?.data?.guest_owner_edits?.includes(
																			"tax_period_ending_date",
																		) && GuestOwnerStyle,
																	)}
																>
																	{convertToLocalDate(
																		quarterlyData?.tax_period_ending_date,
																		"MMMM DD, YYYY",
																	) ?? ""}
																	<ConditionalPlusIcon
																		isNotapplicant={taxStatus?.data?.guest_owner_edits?.includes(
																			"tax_period_ending_date",
																		)}
																	/>
																</p>
															</div>
															<div>
																<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
																	Return Filed/Processed
																</p>
																<p
																	className={twMerge(
																		"py-2 text-sm font-medium tracking-tight break-words text-slate-800",
																		taxStatus?.data?.guest_owner_edits?.includes(
																			"filed_date",
																		) && GuestOwnerStyle,
																	)}
																>
																	{convertToLocalDate(
																		quarterlyData?.filed_date,
																		"MMMM DD, YYYY",
																	) ?? ""}
																	<ConditionalPlusIcon
																		isNotapplicant={taxStatus?.data?.guest_owner_edits?.includes(
																			"filed_date",
																		)}
																	/>
																</p>
															</div>
															<div>
																<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
																	Amount filled
																</p>
																<p
																	className={twMerge(
																		"py-2 text-sm font-medium tracking-tight break-words text-slate-800",
																		taxStatus?.data?.guest_owner_edits?.includes(
																			"amount_filed",
																		) && GuestOwnerStyle,
																	)}
																>
																	{formatPrice(
																		Number(quarterlyData?.amount_filed),
																	) ?? ""}
																	<ConditionalPlusIcon
																		isNotapplicant={taxStatus?.data?.guest_owner_edits?.includes(
																			"amount_filed",
																		)}
																	/>
																</p>
															</div>
															<div>
																<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
																	Account balance
																</p>
																<p
																	className={twMerge(
																		"py-2 text-sm font-medium tracking-tight break-words text-slate-800",
																		taxStatus?.data?.guest_owner_edits?.includes(
																			"balance",
																		) && GuestOwnerStyle,
																	)}
																>
																	{formatPrice(
																		Number(quarterlyData?.balance),
																	) ?? ""}
																	<ConditionalPlusIcon
																		isNotapplicant={taxStatus?.data?.guest_owner_edits?.includes(
																			"balance",
																		)}
																	/>
																</p>
															</div>
															<div>
																<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
																	Accrued Interest
																</p>
																<p
																	className={twMerge(
																		"py-2 text-sm font-medium tracking-tight break-words text-slate-800",
																		taxStatus?.data?.guest_owner_edits?.includes(
																			"interest",
																		) && GuestOwnerStyle,
																	)}
																>
																	{formatPrice(
																		Number(quarterlyData?.interest),
																	) ?? ""}
																	<br />
																	(As of{" "}
																	{convertToLocalDate(
																		quarterlyData?.interest_date,
																		"MMMM DD, YYYY",
																	) ?? ""}
																	)
																	<ConditionalPlusIcon
																		isNotapplicant={taxStatus?.data?.guest_owner_edits?.includes(
																			"interest",
																		)}
																	/>
																</p>
															</div>
															<div>
																<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
																	Accrued Penalty
																</p>
																<p
																	className={twMerge(
																		"py-2 text-sm font-medium tracking-tight break-words text-slate-800",
																		taxStatus?.data?.guest_owner_edits?.includes(
																			"penalty",
																		) && GuestOwnerStyle,
																	)}
																>
																	{formatPrice(
																		Number(quarterlyData?.penalty),
																	) ?? "34234234"}
																	<br />
																	(As of{" "}
																	{convertToLocalDate(
																		quarterlyData?.penalty_date,
																		"MMMM DD, YYYY",
																	) ?? ""}
																	)
																	<ConditionalPlusIcon
																		isNotapplicant={taxStatus?.data?.guest_owner_edits?.includes(
																			"penalty",
																		)}
																	/>
																</p>
															</div>
														</div>
													),
												)}

												<DownloadDocument documentYear={String(tax.period)} />
											</div>
										</div>
									</div>
								</div>
							),
						)
					) : (
						<div>
							<div className="py-2">
								<TitleLeftDivider
									text={`Tax filing year ${String(new Date().getFullYear())} `}
								></TitleLeftDivider>
								<div className="text-xs pl-2.5">Tax Return: Form 1120</div>
							</div>

							<div className="container mx-auto">
								<div className="grid grid-cols-1 gap-6 pl-3 sm:grid-cols-2 md:grid-cols-3">
									<div>
										<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
											Total sales
										</p>
										<p className="py-2 text-sm font-medium tracking-tight break-words text-slate-800">
											-
										</p>
									</div>
									<div>
										<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
											Total compensation
										</p>
										<p className="py-2 text-sm font-medium tracking-tight break-words text-slate-800">
											-
										</p>
									</div>
									<div>
										<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
											Total wages
										</p>
										<p className="py-2 text-sm font-medium tracking-tight break-words text-slate-800">
											-
										</p>
									</div>
									<div>
										<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
											Cost of goods sold
										</p>
										<p className="py-2 text-sm font-medium tracking-tight break-words text-slate-800">
											-
										</p>
									</div>
									<div>
										<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
											IRS balance
										</p>
										<p className="py-2 text-sm font-medium tracking-tight break-words text-slate-800">
											-
										</p>
									</div>
									<div>
										<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
											IRS liens
										</p>
										<p className="py-2 text-sm font-medium tracking-tight break-words text-slate-800">
											-
										</p>
									</div>
									<div className="col-span-1 sm:col-span-2 md:col-span-3">
										<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 ">
											<div className="col-span-1 py-2 text-xs font-normal tracking-tight sm:col-span-2 md:col-span-3">
												Employer’s Quarterly Federal Tax Return: Form 941
											</div>
											<div>
												<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
													Tax Period Ending
												</p>
												<p className="py-2 text-sm font-medium tracking-tight break-words text-slate-800">
													-
												</p>
											</div>
											<div>
												<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
													Return Filed/Processed
												</p>
												<p className="py-2 text-sm font-medium tracking-tight break-words text-slate-800">
													-
												</p>
											</div>
											<div>
												<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
													Amount filled
												</p>
												<p className="py-2 text-sm font-medium tracking-tight break-words text-slate-800">
													-
												</p>
											</div>
											<div>
												<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
													Account balance
												</p>
												<p className="py-2 text-sm font-medium tracking-tight break-words text-slate-800">
													-
												</p>
											</div>
											<div>
												<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
													Accrued Interest
												</p>
												<p className="py-2 text-sm font-medium tracking-tight break-words text-slate-800">
													-
												</p>
											</div>
											<div>
												<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
													Accrued Penalty
												</p>
												<p className="py-2 text-sm font-medium tracking-tight break-words text-slate-800">
													-
												</p>
											</div>
										</div>

										<DownloadDocument documentYear={""} />
									</div>
								</div>
							</div>
						</div>
					)}
				</>
			)}
			{featureFlags[FEATURE_FLAGES?.PAT_466_TRIGGERING_APPLICATION_EDIT] &&
				taxStatus?.data?.guest_owner_edits?.length && (
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

export default Taxes;
