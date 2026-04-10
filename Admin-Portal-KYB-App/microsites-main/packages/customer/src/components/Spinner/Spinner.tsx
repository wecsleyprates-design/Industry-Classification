import React from "react";
import classes from "./Spinner.module.scss";
interface SpinnerProps {
	type?: "lg" | "sm";
}
const Spinner: React.FC<SpinnerProps> = ({ type = "sm" }) => {
	return (
		<div
			className={`${classes.loader} ${type === "lg" ? classes.lgloader : ""}`}
		/>
	);
};

export default Spinner;
