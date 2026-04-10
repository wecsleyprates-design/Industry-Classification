import { TitleLeftDivider } from "@/components/Dividers";

export const NullStateTaxes: React.FC<{
	irsStatus: "NOT_STARTED" | "PENDING";
}> = ({ irsStatus }) => {
	return (
		<>
			{irsStatus === "PENDING" ? (
				<p className="text-xs font-normal px-2">
					Tax consent was provided, awaiting IRS response. Transcripts are
					typically available within 3-5 business days. Check back soon for
					updates.
				</p>
			) : (
				<p className="text-xs font-normal px-2">
					No consent provided - contact the user to connect their tax filing.
				</p>
			)}
			<div>
				<div className="py-2">
					<TitleLeftDivider
						text={`Tax filing year ${String(new Date().getFullYear())} `}
					></TitleLeftDivider>
					<div className="text-xs pl-2.5">Tax Return: Form 1120</div>
				</div>

				<div className="container mx-auto">
					<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 pl-3">
						<div>
							<p className="text-xs py-2 font-normal text-gray-500 tracking-tight">
								Total sales
							</p>
							<p className=" break-words  font-medium text-sm py-2 text-gray-300 tracking-tight">
								Pending
							</p>
						</div>
						<div>
							<p className="text-xs py-2 font-normal text-gray-500 tracking-tight">
								Total compensation
							</p>
							<p className=" break-words  font-medium text-sm py-2 text-gray-300 tracking-tight">
								Pending
							</p>
						</div>
						<div>
							<p className="text-xs py-2 font-normal text-gray-500 tracking-tight">
								Total wages
							</p>
							<p className=" break-words  font-medium text-sm py-2 text-gray-300 tracking-tight">
								Pending
							</p>
						</div>
						<div>
							<p className="text-xs py-2 font-normal text-gray-500 tracking-tight">
								Cost of goods sold
							</p>
							<p className=" break-words  font-medium text-sm py-2 text-gray-300 tracking-tight">
								Pending
							</p>
						</div>
						<div>
							<p className="text-xs py-2 font-normal text-gray-500 tracking-tight">
								IRS balance
							</p>
							<p className=" break-words  font-medium text-sm py-2 text-gray-300 tracking-tight">
								Pending
							</p>
						</div>
						<div>
							<p className="text-xs py-2 font-normal text-gray-500 tracking-tight">
								IRS liens
							</p>
							<p className=" break-words  font-medium text-sm py-2 text-gray-300 tracking-tight">
								Pending
							</p>
						</div>
					</div>
					<div className="col-span-1 sm:col-span-2 md:col-span-3  pl-3">
						<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 my-8 gap-4">
							<div className="col-span-1 sm:col-span-2 md:col-span-3 text-xs font-normal tracking-tight text-[#1E1E1E]">
								Employer’s Quarterly Federal Tax Return: Form 941
							</div>
							<div>
								<p className="text-xs py-2 font-normal text-gray-500 tracking-tight">
									Tax Period Ending
								</p>
								<p className=" break-words  font-medium text-sm py-2 text-gray-300 tracking-tight">
									Pending
								</p>
							</div>
							<div>
								<p className="text-xs py-2 font-normal text-gray-500 tracking-tight">
									Return Filed/Processed
								</p>
								<p className=" break-words  font-medium text-sm py-2 text-gray-300 tracking-tight">
									Pending
								</p>
							</div>
							<div>
								<p className="text-xs py-2 font-normal text-gray-500 tracking-tight">
									Amount filled
								</p>
								<p className=" break-words  font-medium text-sm py-2 text-gray-300 tracking-tight">
									Pending
								</p>
							</div>
							<div>
								<p className="text-xs py-2 font-normal text-gray-500 tracking-tight">
									Account balance
								</p>
								<p className=" break-words  font-medium text-sm py-2 text-gray-300 tracking-tight">
									Pending
								</p>
							</div>
							<div>
								<p className="text-xs py-2 font-normal text-gray-500 tracking-tight">
									Accrued Interest
								</p>
								<p className=" break-words  font-medium text-sm py-2 text-gray-300 tracking-tight">
									Pending
								</p>
							</div>
							<div>
								<p className="text-xs py-2 font-normal text-gray-500 tracking-tight">
									Accrued Penalty
								</p>
								<p className=" break-words  font-medium text-sm py-2 text-gray-300 tracking-tight">
									Pending
								</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		</>
	);
};
