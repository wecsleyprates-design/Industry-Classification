import React, { type FC } from "react";
import { TitleLeftDivider } from "@/components/Dividers";
import TableLoader from "@/components/Spinner/TableLoader";
import TableBody from "@/components/Table/TableBody";
import TableHeader from "@/components/Table/TableHeader";
import { type column } from "@/components/Table/types";
import { convertToDateRange, formatPrice } from "@/lib/helper";

interface Props {
	balanceData: any;
	loadingBalance: boolean;
}

const Balance: FC<Props> = ({ balanceData, loadingBalance }) => {
	const columns: column[] = [
		{
			title: "Balance sheet",
			path: "year",
			content: (item) => {
				return (
					<div className="text-sm font-medium text-black truncate">
						{" "}
						{convertToDateRange(item?.start_date, item?.end_date)}
					</div>
				);
			},
		},
		{
			title: "Total assets",
			path: "total_assets",
			content: (item) => {
				return (
					<div className="text-sm font-medium text-black truncate">
						{formatPrice(item?.total_assets) ?? 0}
					</div>
				);
			},
		},
		{
			title: "Total equity",
			path: "total_equity",
			content: (item) => {
				return (
					<div className="text-sm font-medium text-black truncate">
						{formatPrice(item?.total_equity) ?? 0}
					</div>
				);
			},
		},
		{
			title: "Total liabilities",
			path: "total_liabilities",
			content: (item) => {
				return (
					<div className="truncate font-medium text-sm text-[#C81E1E]">
						{formatPrice(item?.total_liabilities) ?? 0}
					</div>
				);
			},
		},
	];

	return (
		<>
			{loadingBalance ? (
				<div
					style={{ display: "flex", justifyContent: "center" }}
					className="py-2 text-base font-normal tracking-tight text-center text-gray-500"
				>
					<TableLoader />
				</div>
			) : (
				balanceData?.length > 0 && (
					<>
						<div className="py-2">
							<TitleLeftDivider text="Balance sheet"></TitleLeftDivider>
						</div>
						<table className="w-full text-left table-no-border">
							<TableHeader columns={columns} />
							<TableBody
								isLoading={loadingBalance}
								columns={columns}
								tableData={{
									total_pages: 1,
									total_items: balanceData?.length,
									records: balanceData ?? [],
								}}
							/>
						</table>
					</>
				)
			)}
		</>
	);
};

export default Balance;
