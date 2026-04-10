import React, { useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
interface PaginationProps {
	currentPage: number;
	totalPages: number;
	onPageChange: (page: number) => void;
	itemsPerPage: number;
}

const Pagination: React.FC<PaginationProps> = ({
	currentPage,
	totalPages,
	onPageChange,
	itemsPerPage,
}) => {
	const [pageNumbers, setPageNumbers] = useState<number[]>([]);
	const [currentPages, setcurrentPage] = useState<number>(0);

	const calculatePageNumbers = () => {
		const pages: number[] = [];
		for (let i = 1; i <= totalPages; i++) {
			pages.push(i);
		}
		setPageNumbers(pages);
	};

	const handlePageChange = (page: number) => {
		setcurrentPage(page);
		onPageChange(page);
	};

	const handlePrevious = () => {
		if (!(currentPages <= 0)) {
			const temp = currentPages - 1;
			setcurrentPage(temp);
			onPageChange(temp);
		}
	};

	const handleNext = () => {
		const temp = currentPages + 1;
		setcurrentPage(temp);
		onPageChange(temp);
	};

	React.useEffect(() => {
		setcurrentPage(currentPage);
		calculatePageNumbers();
	}, [totalPages, currentPage]);

	return (
		<>
			<div className="flex items-center justify-between bg-white">
				<div className="flex flex-1 justify-between sm:hidden">
					<a
						onClick={() => {
							handlePrevious();
						}}
						className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
					>
						Previous
					</a>
					<a
						onClick={() => {
							handleNext();
						}}
						className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
					>
						Next
					</a>
				</div>
				<div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
					<div>
						<p className="text-sm text-gray-700">
							Showing <span className="font-medium">1</span> to{" "}
							<span className="font-medium">10</span> of{" "}
							<span className="font-medium">97</span> results
						</p>
					</div>
					<div>
						<nav
							className="isolate inline-flex -space-x-px rounded-md shadow-sm"
							aria-label="Pagination"
						>
							<a
								onClick={() => {
									handlePrevious();
								}}
								className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0"
							>
								<span className="sr-only">Previous</span>
								<ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
							</a>
							{pageNumbers.map((page) => (
								<a
									key={page}
									aria-current="page"
									onClick={() => {
										handlePageChange(page);
									}}
									className={`${
										page !== currentPages
											? "relative hidden items-center px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 md:inline-flex"
											: "relative z-10 inline-flex items-center bg-black px-4 py-2 text-sm font-semibold text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
									} `}
								>
									{page}
								</a>
							))}
							<span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300 focus:outline-offset-0">
								...
							</span>
							<a
								href="#"
								className="relative hidden items-center px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 md:inline-flex"
							>
								8
							</a>
							<a
								onClick={() => {
									handleNext();
								}}
								className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0"
							>
								<span className="sr-only">Next</span>
								<ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
							</a>
						</nav>
					</div>
				</div>
			</div>
		</>
	);
};
export default Pagination;
