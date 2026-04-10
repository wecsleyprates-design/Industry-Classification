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
	showPageSizes,
	seprator,
}) => {
	return (
		<div>
			<div className="flow-root">
				<div className="mx-2 overflow-x-auto sm:mx-1 lg:mx-2">
					<div className="inline-block min-w-full pb-2 align-middle">
						<table className="w-full min-w-full text-left divide-y divide-gray-300">
							<TableHeader
								columns={columns}
								sortHandler={sortHandler}
								payload={payload}
							/>
							<TableBody
								isLoading={isLoading}
								columns={columns}
								tableData={tableData}
								seprator={seprator}
							/>
						</table>
						<Pagination
							tableData={tableData}
							page={page}
							itemsPerPage={itemsPerPage}
							paginationHandler={paginationHandler}
							itemsPerPageHandler={itemsPerPageHandler}
							totalColumns={columns?.length}
							showPageSizes={showPageSizes}
						/>
					</div>
				</div>
			</div>
		</div>
	);
};

export default Table;
