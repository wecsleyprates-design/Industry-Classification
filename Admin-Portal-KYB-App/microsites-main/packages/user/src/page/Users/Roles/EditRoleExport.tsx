import React from "react";
import EditRole from "./EditRole";

import { ToastProvider } from "@/providers/ToastProvider";

const EditRoleExport = () => {
	return (
		<>
			<ToastProvider />
			<EditRole />
		</>
	);
};

export default EditRoleExport;
