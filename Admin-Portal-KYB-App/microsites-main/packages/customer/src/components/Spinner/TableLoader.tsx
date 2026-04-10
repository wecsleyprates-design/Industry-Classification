import React from "react";
import classes from "./Spinner.module.scss";

const TableLoader = () => {
	return (
		<div
			className={`${classes.loader} " border-t-white border-r-white border-[#6B66C4] border-l-[#6B66C4] w-8 h-8 border-4 border-l-8"`}
		/>
	);
};

export default TableLoader;
