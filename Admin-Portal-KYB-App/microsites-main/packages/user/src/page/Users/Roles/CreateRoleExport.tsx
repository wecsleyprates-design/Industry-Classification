import React from "react";
import CreateRole from "./CreateRole";

import { ToastProvider } from "@/providers/ToastProvider";

const CreateRoleExport = () => {
	return (
		<>
			<ToastProvider />
			<CreateRole />
		</>
	);
};

export default CreateRoleExport;
