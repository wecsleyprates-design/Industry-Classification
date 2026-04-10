import React from "react";
import Modal from "../Modal";
import Spinner from "./Spinner";

const FullPageLoader = () => {
	return (
		<Modal isOpen={true} onClose={() => {}} cardColorClass="">
			<div className="flex items-center justify-center">
				<Spinner type="lg" />
			</div>
		</Modal>
	);
};

export default FullPageLoader;
