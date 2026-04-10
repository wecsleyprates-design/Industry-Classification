import React, { type FC } from "react";
import { TitleLeftDivider } from "@/components/Dividers";
import { convertToYearRange, formatPrice } from "@/lib/helper";

const Income: FC<{
	incomeData: any;
}> = ({ incomeData }) => {
	return (
		<>
			{incomeData && incomeData.length > 0 ? (
				<>
					<div className="pt-2 pb-5">
						<TitleLeftDivider
							text="Income Statement/P&L"
							textStyleClasses={"text-base bg-white px-2 text-gray-500"}
						></TitleLeftDivider>
					</div>
					{incomeData.map((data: Record<string, any>) => {
						return (
							<>
								<div className="py-2">
									<TitleLeftDivider
										text={
											<div className="flex flex-row">
												<div>Year&nbsp;</div>
												<div className="font-bold text-black">
													{convertToYearRange(Number(data.year))}
												</div>
											</div>
										}
									></TitleLeftDivider>
								</div>
								<div className="container mx-auto">
									<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
										<div className="p-4">
											<p className="text-xs py-2 font-normal text-[#5E5E5E] tracking-tight">
												Sales / income
											</p>
											<p className="break-words font-medium text-sm py-2 text-[#1E1E1E] tracking-tight">
												{/* {formatPrice(data?.cost_of_sales?.value) ?? "-"} */}
												{formatPrice(data?.total_revenue) ?? "-"}
											</p>
										</div>
										<div className="p-4">
											<p className="text-xs py-2 font-normal text-[#5E5E5E] tracking-tight">
												Total sales / income
											</p>
											<p className="break-words font-medium text-sm py-2 text-[#1E1E1E] tracking-tight">
												{formatPrice(data?.total_revenue) ?? "-"}
											</p>
										</div>
										<div className="p-4">
											<p className="text-xs py-2 font-normal text-[#5E5E5E] tracking-tight">
												COGS
											</p>
											<p className="break-words font-medium text-sm py-2 text-[#1E1E1E] tracking-tight">
												{formatPrice(data?.total_cost_of_goods_sold) ?? "-"}
											</p>
										</div>
									</div>
								</div>
								<div className="container mx-auto">
									<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
										<div className="p-4">
											<p className="text-xs py-2 font-normal text-[#5E5E5E] tracking-tight">
												Gross profit
											</p>
											<p className="break-words font-medium text-sm py-2 text-[#1E1E1E] tracking-tight">
												{formatPrice(
													Number(data?.total_revenue) -
														Number(data?.total_cost_of_goods_sold),
												) ?? "-"}
											</p>
										</div>
										<div className="p-4">
											<p className="text-xs py-2 font-normal text-[#5E5E5E] tracking-tight">
												Expenses
											</p>
											<p className="break-words font-medium text-sm py-2 text-[#1E1E1E] tracking-tight">
												{formatPrice(data?.total_expenses) ?? "-"}
											</p>
										</div>
										<div className="p-4">
											<p className="text-xs py-2 font-normal text-[#5E5E5E] tracking-tight">
												Total expenses
											</p>
											<p className="break-words font-medium text-sm py-2 text-[#1E1E1E] tracking-tight">
												{formatPrice(
													Number(data?.total_expenses) +
														Number(data?.total_depreciation),
												) ?? "-"}
											</p>
										</div>
									</div>
								</div>
								<div className="container mx-auto">
									<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
										<div className="p-4">
											<p className="text-xs py-2 font-normal text-[#5E5E5E] tracking-tight">
												Net operating income
											</p>
											<p className="break-words font-medium text-sm py-2 text-[#1E1E1E] tracking-tight">
												{formatPrice(data?.net_income) ?? "-"}
											</p>
										</div>
									</div>
								</div>
							</>
						);
					})}
				</>
			) : (
				<div className="py-2 text-base font-normal tracking-tight text-center text-gray-500">
					Data not found
				</div>
			)}
		</>
	);
};

export default Income;
