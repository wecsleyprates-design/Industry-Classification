import React, { type FC } from "react";
import {
	ArrowDownTrayIcon,
	DocumentTextIcon,
	PhotoIcon,
} from "@heroicons/react/24/outline";
import TableLoader from "@/components/Spinner/TableLoader";

interface Props {
	uploadedStatements: any[];
	loading: boolean;
}

const UploadedStatements: FC<Props> = ({ uploadedStatements, loading }) => {
	return (
		<>
			<div className="w-full p-6 pt-2 mt-8 mb-8 bg-white border rounded-lg shadow">
				<h2 className="mb-4 text-lg font-semibold text-gray-900">
					Uploaded Statements
				</h2>
				{uploadedStatements?.length > 0 && (
					<div className="my-4 space-y-2">
						{uploadedStatements?.map((item, index) => (
							<div
								key={index}
								className="flex items-center justify-between p-4 bg-transparent border border-gray-200 rounded-lg"
							>
								<div className="flex items-center gap-2">
									{item?.file_name?.includes("pdf") ? (
										<DocumentTextIcon className="p-1 text-gray-600 bg-gray-100 rounded-lg size-7" />
									) : (
										<PhotoIcon className="p-1 text-gray-600 bg-gray-100 rounded-lg size-7" />
									)}
									<p className="text-sm text-gray-600">{item?.file_name}</p>
								</div>
								<ArrowDownTrayIcon
									className="p-1 rounded-lg cursor-pointer size-7 hover:bg-gray-100 text-blue-600"
									onClick={async () => {
										if (item?.file_url) {
											window.open(item?.file_url, "_blank");
										}
									}}
								/>
							</div>
						))}
					</div>
				)}
				{!uploadedStatements?.length && (
					<div
						style={{ display: "flex", justifyContent: "center" }}
						className="py-2 mt-5 text-base font-normal tracking-tight text-center text-gray-500"
					>
						{loading ? <TableLoader /> : "Data not found"}
					</div>
				)}
			</div>
		</>
	);
};

export default UploadedStatements;
