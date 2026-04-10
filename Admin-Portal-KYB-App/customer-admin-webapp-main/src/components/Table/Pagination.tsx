import React, { useEffect, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/20/solid";
import useDidMountEffect from "@/hooks/useDidMountEffect";
import { type TOption } from "@/types/common";
import { DropDownWithIcon } from "../Dropdown";
import { type IPagination } from "./types";

const defaultClass =
	"relative inline-flex cursor-pointer items-center px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0";
const activeClass =
	"relative z-10 inline-flex cursor-pointer items-center bg-slate-800 px-4 py-2 text-sm font-semibold text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";

const TruncateComponent = () => (
	<span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300 focus:outline-offset-0">
		...
	</span>
);

const ItemsCountComponent: React.FC<{
	totalItems: number;
	totalInPage: number;
	itemsPerPage: number;
	start: number;
	end: number;
	itemsPerPageHandler: (value: number) => void;
	totalColumns?: number;
	isShowPageSizes: boolean;
}> = ({
	totalItems,
	totalInPage,
	itemsPerPage,
	itemsPerPageHandler,
	start,
	end,
	totalColumns,
	isShowPageSizes = true,
}) => {
	const [itemsPerPageVal, setItemsPerPageVal] = useState<number>(
		itemsPerPage ?? 10,
	);
	const [itemsPerPageOptions] = useState<TOption[]>([
		{ label: "5", value: "5" },
		{ label: "10", value: "10" },
		{ label: "20", value: "20" },
		{ label: "50", value: "50" },
	]);

	return (
		<div
			className={`flex flex-auto items-center justify-between pr-5 ${
				totalColumns && totalColumns < 3 ? "w-screen sm:w-full" : ""
			}`}
		>
			<div>
				<p className="text-xs font-normal text-gray-700">
					Showing <span className="text-sm font-medium">{start}</span> to{" "}
					<span className="text-sm font-medium">{end}</span> of{" "}
					<span className="text-sm font-medium">{totalItems}</span> results
				</p>
			</div>
			{isShowPageSizes && (
				<div className="flex items-center flex-grow-0 gap-2">
					<span className="text-xs font-normal">Page size:</span>
					<DropDownWithIcon
						title={`${totalInPage}`}
						value={itemsPerPage}
						onChange={(value) => {
							setItemsPerPageVal(value as number);
							itemsPerPageHandler(value as number);
						}}
						options={
							totalItems < 2
								? itemsPerPageOptions.slice(0, 3)
								: itemsPerPageOptions
						}
					/>
				</div>
			)}
		</div>
	);
};

const Pagination: React.FC<IPagination> = ({
	tableData,
	page,
	itemsPerPage,
	paginationHandler,
	itemsPerPageHandler,
	totalColumns,
	showPageSizes,
}) => {
	const [leastPages] = useState(7);
	const [pages, setPages] = useState<number[]>([]);
	const [activePage, setActivePage] = useState<number>(page);
	const [totalItems, setTotalItems] = useState<number>(0);
	const [totalPages, setTotalPages] = useState<number>(1);
	const [startItem, setStartItem] = useState<number>(0);
	const [endItem, setEndItem] = useState<number>(0);

	useEffect(() => {
		if (tableData?.records.length > 0) {
			if (tableData?.records.length < itemsPerPage) {
				setEndItem(itemsPerPage * (activePage - 1) + tableData?.records.length);
			} else setEndItem(itemsPerPage * activePage);
			setStartItem(itemsPerPage * (activePage - 1) + 1);
		} else {
			setStartItem(0);
			setEndItem(0);
		}
	}, [activePage, itemsPerPage, tableData?.records]);

	useEffect(() => {
		// TODO: Handle page > total_pages case
		setActivePage(page);
	}, [page]);

	useEffect(() => {
		setTotalPages(
			tableData?.total_pages
				? tableData?.total_pages === 0
					? 1
					: tableData?.total_pages
				: 1,
		);
		setTotalItems(tableData?.total_items);
	}, [tableData]);

	useEffect(() => {
		if (totalPages > leastPages) {
			const arr = [];
			if (activePage > 3 && activePage <= totalPages - 3) {
				arr.push(1);
				arr.push(0);
				arr.push(activePage - 1);
				arr.push(activePage);
				arr.push(activePage + 1);
				arr.push(0);
				arr.push(totalPages);
			} else if (activePage <= 3) {
				for (let i = 1; i <= 4; i++) {
					arr.push(i);
				}
				arr.push(0);
				arr.push(totalPages - 1);
				arr.push(totalPages);
			} else if (activePage > totalPages - 3) {
				arr.push(1);
				arr.push(2);
				arr.push(0);
				for (let i = totalPages - 3; i <= totalPages; i++) {
					arr.push(i);
				}
			}
			setPages(arr);
		} else {
			const arr = [];
			for (let i = 1; i <= totalPages; i++) {
				arr.push(i);
			}
			setPages(arr);
		}
	}, [totalPages, activePage]);

	useDidMountEffect(() => {
		paginationHandler(activePage);
	}, [activePage]);

	const backPageHandler = () => {
		if (activePage > 1) {
			setActivePage((val) => val - 1);
		}
	};

	const nextPageHandler = () => {
		if (activePage < totalPages) {
			setActivePage((val) => val + 1);
		}
	};

	const pageSelectHandler = (pageNo: number) => {
		setActivePage(pageNo);
	};

	return (
		<div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200 sm:px-6">
			<div className="flex items-center justify-between flex-1 sm:hidden">
				<ItemsCountComponent
					itemsPerPageHandler={itemsPerPageHandler}
					totalInPage={tableData?.records.length}
					itemsPerPage={itemsPerPage}
					start={startItem}
					end={endItem}
					totalItems={totalItems}
					totalColumns={totalColumns}
					isShowPageSizes={showPageSizes ?? true}
				/>
				<div className="flex justify-between sm:hidden">
					<a
						onClick={backPageHandler}
						className="relative inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 cursor-pointer rounded-l-md hover:bg-gray-50"
					>
						<ChevronLeftIcon className="w-5 h-5" aria-hidden="true" />
						Previous
					</a>
					<a
						aria-current="page"
						className="relative z-10 inline-flex items-center px-4 py-2 text-sm font-semibold text-white cursor-pointer bg-slate-700 focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
					>
						{activePage}
					</a>
					<a
						onClick={nextPageHandler}
						className="relative inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 cursor-pointer rounded-r-md hover:bg-gray-50"
					>
						Next
						<ChevronRightIcon className="w-5 h-5" aria-hidden="true" />
					</a>
				</div>
			</div>
			<div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
				<ItemsCountComponent
					itemsPerPageHandler={itemsPerPageHandler}
					totalInPage={tableData?.records.length}
					itemsPerPage={itemsPerPage}
					totalItems={totalItems}
					start={startItem}
					end={endItem}
					totalColumns={totalColumns}
					isShowPageSizes={showPageSizes ?? true}
				/>
				<div>
					<nav
						className="inline-flex -space-x-px rounded-md shadow-sm isolate"
						aria-label="Pagination"
					>
						<a
							onClick={backPageHandler}
							className="relative inline-flex items-center px-2 py-2 text-gray-400 cursor-pointer rounded-l-md ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0"
						>
							<span className="sr-only">Previous</span>
							<ChevronLeftIcon className="w-5 h-5" aria-hidden="true" />
						</a>
						{pages.map((pageNo, i) => {
							return pageNo ? (
								<a
									key={i}
									onClick={() => {
										pageSelectHandler(pageNo);
									}}
									className={activePage === pageNo ? activeClass : defaultClass}
								>
									<span className="text-sm font-medium">{pageNo} </span>
								</a>
							) : (
								<TruncateComponent key={i} />
							);
						})}
						<a
							onClick={nextPageHandler}
							className="relative inline-flex items-center px-2 py-2 text-gray-400 cursor-pointer rounded-r-md ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0"
						>
							<span className="sr-only">Next</span>
							<ChevronRightIcon className="w-5 h-5" aria-hidden="true" />
						</a>
					</nav>
				</div>
			</div>
		</div>
	);
};

export default Pagination;
