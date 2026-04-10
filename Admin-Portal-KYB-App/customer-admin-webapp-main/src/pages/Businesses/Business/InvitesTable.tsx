import TableBody from "@/components/Table/TableBody";
import TableHeader from "@/components/Table/TableHeader";
import { type column } from "@/components/Table/types";

type Props = {
	data: any;
	loading: boolean;
};

const InvitesTable: React.FC<Props> = ({ data, loading }) => {
	const finalData = data;
	const columns: column[] = [
		{
			title: "Name",
			path: "name",
			content: (item) => {
				return (
					<div className="truncate font-medium text-sm text-black">
						{(item?.first_name as string) + " " + (item?.last_name as string)}
					</div>
				);
			},
		},
		{
			title: "Email",
			path: "email",
			content: (item) => {
				return (
					<div className="truncate font-medium text-sm text-black ">
						{item?.email}
					</div>
				);
			},
		},
	];

	return (
		<div className="overflow-clip w-full	">
			<div className="p-4 px-3 font-semibold">Invitees</div>
			<div className="divide-y divide-gray-200 rounded-lg bg-white shadow border " />
			<table className="w-full text-left divide-y divide-gray-300">
				<TableHeader columns={columns} />

				<TableBody
					isLoading={loading}
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

export default InvitesTable;
