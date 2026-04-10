import StatusBadge from "@/components/Badge/StatusBadge";
import TableBody from "@/components/Table/TableBody";
import TableHeader from "@/components/Table/TableHeader";
import { type column } from "@/components/Table/types";
import { capitalize, convertToLocalDate, getStatusType } from "@/lib/helper";

const InvitesHistoryTable = (data: any) => {
	const finalData = data?.data;
	const columns: column[] = [
		{
			title: "Date",
			path: "date",
			content: (item) => {
				return (
					<div className="truncate font-medium text-sm text-black">
						{convertToLocalDate(item?.created_at, "MM-DD-YYYY - h:mmA")}
					</div>
				);
			},
		},
		{
			title: "Action / Status",
			path: "status",
			content: (item) => {
				return (
					<div className="truncate font-medium text-sm text-black">
						<StatusBadge
							type={getStatusType(item?.status)}
							text={capitalize(item?.status as string)}
						/>
					</div>
				);
			},
		},
	];

	return (
		<div className="overflow-clip w-full	">
			<div className="p-4 px-3 font-semibold">History</div>
			<div className="divide-y divide-gray-200 rounded-lg bg-white shadow border " />
			<table className="w-full text-left divide-y divide-gray-300">
				<TableHeader columns={columns} />

				<TableBody
					isLoading={false}
					columns={columns}
					tableData={{
						total_pages: 1,
						total_items: finalData?.length,
						records: finalData ?? [],
					}}
				/>
			</table>
		</div>
	);
};

export default InvitesHistoryTable;
