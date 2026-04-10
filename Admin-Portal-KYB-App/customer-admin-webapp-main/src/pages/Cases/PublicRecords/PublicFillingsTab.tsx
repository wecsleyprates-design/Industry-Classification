import { twMerge } from "tailwind-merge";
import { TitleLeftDivider } from "@/components/Dividers";
import { convertToLocalDate } from "@/lib/helper";
import { type PublicRecordsResponseData } from "@/types/publicRecords";

type Props = {
	publicRecords?: PublicRecordsResponseData;
};

const PublicFillingsTab: React.FC<Props> = ({ publicRecords }) => {
	const ViewBox = ({
		body,
		header,
		outerClassNames,
	}: {
		header: string;
		body: string | number;
		outerClassNames?: string;
	}) => {
		return (
			<div className={twMerge("py-4", outerClassNames)}>
				<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
					{header}
				</p>
				<p className="py-2 text-sm font-medium tracking-tight break-words text-slate-800">
					{body}
				</p>
			</div>
		);
	};

	return (
		<>
			{JSON.stringify(publicRecords) === "{}" ? (
				<div className="py-2 text-base font-normal tracking-tight text-center text-gray-500">
					Data not found
				</div>
			) : (
				<div className="border border-gray-200 rounded-2xl">
					<div className="flex items-center justify-between h-10 mx-6 my-4 font-medium">
						Public Filings
					</div>
					<div className="px-6">
						<div className="container mx-auto">
							<div className="grid grid-cols-1 gap-x-5 sm:grid-cols-2 md:grid-cols-3">
								<>
									<span className="col-span-2 md:col-span-3">
										<TitleLeftDivider
											text="Judgements"
											textStyleClasses="bg-white pr-2 text-base text-gray-500 mb-0.5"
										/>
									</span>
									<ViewBox
										header={"Number of judgement filings"}
										body={
											publicRecords?.public_records
												?.number_of_judgement_fillings ?? "-"
										}
									/>
									<ViewBox
										header={"Most recent judgement filing date"}
										body={
											publicRecords?.public_records
												?.most_recent_judgement_filling_date
												? convertToLocalDate(
														String(
															publicRecords?.public_records
																?.most_recent_judgement_filling_date,
														),
														"MM-DD-YYYY - h:mmA",
													)
												: "-"
										}
										outerClassNames="col-span-2"
									/>
								</>
								<>
									<span className="col-span-2 md:col-span-3 mt-0.5">
										<TitleLeftDivider
											text="Liens"
											textStyleClasses="bg-white pr-2 text-base text-gray-500 mb-0.5"
										/>
									</span>
									<ViewBox
										header={"Number of business liens"}
										body={
											publicRecords?.public_records?.number_of_business_liens ??
											"-"
										}
									/>
									<ViewBox
										header={"Most recent business lien filing date"}
										body={
											publicRecords?.public_records
												?.most_recent_business_lien_filing_date
												? convertToLocalDate(
														String(
															publicRecords?.public_records
																?.most_recent_business_lien_filing_date,
														),
														"MM-DD-YYYY - h:mmA",
													)
												: "-"
										}
										outerClassNames="col-span-2 md:col-span-1"
									/>

									<ViewBox
										header={"Most recent business lien status"}
										body={
											publicRecords?.public_records
												?.most_recent_business_lien_status ?? "-"
										}
									/>
								</>
								<>
									<span className="col-span-2 md:col-span-3">
										<TitleLeftDivider
											text="Bankruptcies"
											textStyleClasses="bg-white pr-2 text-base text-gray-500 mb-0.5"
										/>
									</span>
									<ViewBox
										header={"Number of bankruptcies"}
										body={
											publicRecords?.public_records?.number_of_bankruptcies ??
											"-"
										}
									/>
									<ViewBox
										header={"Most recent bankruptcy filing date"}
										body={
											publicRecords?.public_records
												?.most_recent_bankruptcy_filing_date
												? convertToLocalDate(
														String(
															publicRecords?.public_records
																?.most_recent_bankruptcy_filing_date,
														),
														"MM-DD-YYYY - h:mmA",
													)
												: "-"
										}
										outerClassNames="col-span-2"
									/>
								</>
								<>
									<span className="col-span-2 md:col-span-3">
										<TitleLeftDivider
											text="Complaints"
											textStyleClasses="bg-white pr-2 text-base text-gray-500 mb-0.5"
										/>
									</span>
									<ViewBox
										header={"Total Complaints"}
										body={
											publicRecords?.public_records?.complaint_statistics
												?.count_of_complaints_all_time ?? "-"
										}
									/>
									<ViewBox
										header={"CFPB Complaints with Alert Words"}
										body={
											publicRecords?.public_records?.complaint_statistics
												?.count_of_consumer_financial_protection_bureau_complaints_all_time
												? `${String(
														publicRecords?.public_records?.complaint_statistics
															?.count_of_consumer_financial_protection_bureau_complaints_all_time,
													)} (${(
														Number(
															publicRecords?.public_records
																?.complaint_statistics
																?.percentage_of_complaints_containing_alert_words_all_time,
														) * 100
													).toFixed(2)}%)`
												: "0"
										}
									/>
									<ViewBox
										header={"FTC Complaints with Alert Words"}
										body={
											publicRecords?.public_records?.complaint_statistics
												?.count_of_federal_trade_commission_complaints_all_time ??
											"-"
										}
									/>
									<ViewBox
										header={"Answered Resolved Status"}
										body={
											publicRecords?.public_records?.complaint_statistics
												?.count_of_answered_resolved_status_all_time
												? `${String(
														publicRecords?.public_records?.complaint_statistics
															?.count_of_answered_resolved_status_all_time,
													)} (${(
														Number(
															publicRecords?.public_records
																?.complaint_statistics
																?.percentage_of_answered_resolved_status_all_time,
														) * 100
													).toFixed(2)}%)`
												: "0"
										}
									/>
									<ViewBox
										header={"Resolved Resolved Status"}
										body={
											publicRecords?.public_records?.complaint_statistics
												?.count_of_resolved_resolved_status_all_time
												? `${String(
														publicRecords?.public_records?.complaint_statistics
															?.count_of_resolved_resolved_status_all_time,
													)} (${(
														Number(
															publicRecords?.public_records
																?.complaint_statistics
																?.percentage_of_resolved_resolved_status_all_time,
														) * 100
													).toFixed(2)}%)`
												: "0"
										}
									/>
									<ViewBox
										header={"Unanswered Resolved Status"}
										body={
											publicRecords?.public_records?.complaint_statistics
												?.count_of_unanswered_resolved_status_all_time
												? `${String(
														publicRecords?.public_records?.complaint_statistics
															?.count_of_unanswered_resolved_status_all_time,
													)} (${(
														Number(
															publicRecords?.public_records
																?.complaint_statistics
																?.percentage_of_unanswered_resolved_status_all_time,
														) * 100
													).toFixed(2)}%)`
												: "0"
										}
									/>

									<ViewBox
										header={"Unresolved Resolved Status"}
										body={
											publicRecords?.public_records?.complaint_statistics
												?.count_of_unresolved_resolved_status_all_time
												? `${String(
														publicRecords?.public_records?.complaint_statistics
															?.count_of_unresolved_resolved_status_all_time,
													)} (${(
														Number(
															publicRecords?.public_records
																?.complaint_statistics
																?.percentage_of_unresolved_resolved_status_all_time,
														) * 100
													).toFixed(2)}%)`
												: "0"
										}
									/>
									<ViewBox
										header={"Other Resolved Status"}
										body={
											publicRecords?.public_records?.complaint_statistics
												?.count_of_other_resolved_status_all_time
												? `${String(
														publicRecords?.public_records?.complaint_statistics
															?.count_of_other_resolved_status_all_time,
													)} (${(
														Number(
															publicRecords?.public_records
																?.complaint_statistics
																?.percentage_of_other_resolved_status_all_time,
														) * 100
													).toFixed(2)}%)`
												: "0"
										}
									/>
								</>
							</div>
						</div>
					</div>
				</div>
			)}
		</>
	);
};

export default PublicFillingsTab;
