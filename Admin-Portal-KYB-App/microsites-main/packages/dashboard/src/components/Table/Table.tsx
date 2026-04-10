import React from "react";
import Pagination from "./Pagination";
import TableBody from "./TableBody";
import TableHeader from "./TableHeader";
import { type TableProps } from "./types";

const Table: React.FC<TableProps> = ({
	columns,
	tableData,
	isLoading,
	sortHandler,
	page,
	itemsPerPage,
	paginationHandler,
	itemsPerPageHandler,
	payload,
}) => {
	return (
		<div>
			<div className="flow-root">
				<div className="mx-2 overflow-x-auto sm:mx-1 lg:mx-2">
					<div className="inline-block min-w-full pb-2 align-middle">
						<table className="min-w-full divide-y divide-[#D9D9D9] w-full text-left">
							<TableHeader
								columns={columns}
								sortHandler={sortHandler}
								payload={payload}
							/>
							<TableBody
								isLoading={isLoading}
								columns={columns}
								tableData={tableData}
							/>
						</table>
						<Pagination
							tableData={tableData}
							page={page}
							itemsPerPage={itemsPerPage}
							paginationHandler={paginationHandler}
							itemsPerPageHandler={itemsPerPageHandler}
						/>
					</div>
				</div>
			</div>
		</div>
	);
};

export default Table;
