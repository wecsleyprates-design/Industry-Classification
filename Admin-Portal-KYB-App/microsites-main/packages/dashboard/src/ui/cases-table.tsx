import { useState } from "react";
import { ExclamationCircleIcon } from "@heroicons/react/24/outline";
import { InfoCircledIcon } from "@radix-ui/react-icons";
import {
	CheckCircle,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	Download,
	Eye,
	Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Input } from "./input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "./table";

export interface TableData {
	caseNumber: string;
	date: string;
	type: string;
	businessName: string;
	worthScore: string;
	status: Statuses[number]["status"];
	assignee: string;
}

type Statuses = Array<{
	status:
		| "Needs Review"
		| "Submitted"
		| "Auto Approved"
		| "Archived"
		| "Auto Rejected"
		| "Manually Rejected";
	icon: React.ReactNode;
	style: string;
}>;

const statuses: Statuses = [
	// exclamation mark
	{
		status: "Needs Review",
		icon: <ExclamationCircleIcon className="w-4 h-4" strokeWidth="2" />,
		style: "bg-yellow-50 text-yellow-700",
	},
	{
		status: "Submitted",
		icon: <Download className="w-4 h-4" />,
		style: "bg-blue-50 text-blue-700",
	},
	{
		status: "Auto Approved",
		icon: <CheckCircle className="w-4 h-4" />,
		style: "bg-green-50 text-green-700",
	},
	{
		status: "Archived",
		icon: <InfoCircledIcon className="w-4 h-4" strokeWidth="2" />,
		style: "bg-gray-50 text-gray-700",
	},
	{
		status: "Auto Rejected",
		icon: <ExclamationCircleIcon className="w-4 h-4" strokeWidth="2" />,
		style: "bg-red-50 text-red-700",
	},
	{
		status: "Manually Rejected",
		icon: <ExclamationCircleIcon className="w-4 h-4" strokeWidth="2" />,
		style: "bg-red-50 text-red-700",
	},
];

const StatusBadge = ({ status }: { status: Statuses[number]["status"] }) => {
	const statusData = statuses.find((s) => s.status === status);

	if (!statusData) {
		return null;
	}

	return (
		<span
			className={`inline-flex items-center rounded-md px-2 py-1 gap-2 text-xs font-medium ${statusData.style}`}
		>
			{statusData.icon}
			{status}
		</span>
	);
};

interface CasesTableProps {
	timeFilter: any; // TimeFilterValue;
	tableData: TableData[];
}

export function CasesTable({ tableData }: CasesTableProps) {
	const [currentPage, setCurrentPage] = useState(1);
	const itemsPerPage = 10;
	const totalPages = Math.ceil(tableData.length / itemsPerPage);

	// Function to generate page numbers with ellipsis
	const getPageNumbers = () => {
		const pages = [];
		if (totalPages <= 7) {
			// If there are 7 or fewer pages, show all
			for (let i = 1; i <= totalPages; i++) {
				pages.push(i);
			}
		} else {
			// Always show first page
			pages.push(1);

			if (currentPage > 3) {
				pages.push("...");
			}

			// Show pages around current page
			const start = Math.max(2, currentPage - 1);
			const end = Math.min(totalPages - 1, currentPage + 1);

			for (let i = start; i <= end; i++) {
				pages.push(i);
			}

			if (currentPage < totalPages - 2) {
				pages.push("...");
			}

			// Always show last page
			pages.push(totalPages);
		}
		return pages;
	};

	// Calculate pagination values
	const paginatedData = tableData.slice(
		(currentPage - 1) * itemsPerPage,
		currentPage * itemsPerPage,
	);

	return (
		<div
			className={cn("rounded-xl bg-card text-card-foreground p-4 space-y-4")}
		>
			<div className="flex items-center justify-between">
				<h2 className="font-semibold text-md">Cases</h2>
				<div className="flex items-center gap-2">
					<Button variant="outline" className="h-10 px-3 text-sm">
						Filter
						<ChevronDown className="w-4 h-4 ml-2" />
					</Button>
					<div className="relative">
						<Search className="absolute w-4 h-4 -translate-y-1/2 left-3 top-1/2 text-muted-foreground" />
						<Input
							className="h-10 w-[300px] pl-9"
							placeholder="Search"
							type="search"
						/>
					</div>
				</div>
			</div>

			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Case #</TableHead>
						<TableHead>
							Date
							<ChevronDown className="inline w-4 h-4 ml-2" />
						</TableHead>
						<TableHead>Type</TableHead>
						<TableHead>Business Name</TableHead>
						<TableHead>Worth Score</TableHead>
						<TableHead>Status</TableHead>
						<TableHead>Assignee</TableHead>
						<TableHead>Actions</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{paginatedData.map((row) => (
						<TableRow key={row.caseNumber}>
							<TableCell className="font-medium text-blue-600">
								{row.caseNumber}
							</TableCell>
							<TableCell>{row.date}</TableCell>
							<TableCell>{row.type}</TableCell>
							<TableCell>{row.businessName}</TableCell>
							<TableCell>{row.worthScore}</TableCell>
							<TableCell>
								<StatusBadge status={row.status} />
							</TableCell>
							<TableCell>{row.assignee}</TableCell>
							<TableCell>
								<div className="flex space-x-2">
									<Button variant="ghost" size="icon">
										<Eye
											className="w-4 h-4"
											color="#2563EB" // blue-600
										/>
									</Button>
									<Button variant="ghost" size="icon">
										<Download
											className="w-4 h-4"
											color="#2563EB" // blue-600
										/>
									</Button>
								</div>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>

			<div className="flex items-center justify-between mt-4">
				<div className="text-sm text-gray-500">
					Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
					{Math.min(currentPage * itemsPerPage, tableData.length)} of{" "}
					{tableData.length} entries
				</div>
				<div className="flex items-center">
					<button
						onClick={() => {
							setCurrentPage(currentPage - 1);
						}}
						disabled={currentPage === 1}
						className="p-2 border border-gray-200 rounded-l-lg hover:bg-gray-100 disabled:opacity-50"
					>
						<ChevronLeft className="w-4 h-4" />
					</button>

					{getPageNumbers().map((pageNum, idx) => (
						<button
							key={idx}
							onClick={() => {
								if (typeof pageNum === "number") {
									setCurrentPage(pageNum);
								}
							}}
							disabled={pageNum === currentPage}
							className={cn(
								"px-3 py-1 border-t border-b border-gray-200",
								// Add right border to all except last element
								idx !== getPageNumbers().length - 1 && "border-r",
								typeof pageNum === "number" && pageNum === currentPage
									? "bg-gray-100 z-10"
									: "hover:bg-gray-50 z-10",
								typeof pageNum === "string" && "cursor-default",
							)}
						>
							{pageNum}
						</button>
					))}

					<button
						onClick={() => {
							setCurrentPage(currentPage + 1);
						}}
						disabled={currentPage === totalPages}
						className="p-2 border border-gray-200 rounded-r-lg hover:bg-gray-100 disabled:opacity-50"
					>
						<ChevronRight className="w-4 h-4" />
					</button>
				</div>
			</div>
		</div>
	);
}
