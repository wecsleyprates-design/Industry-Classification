import { CustomerWrapper } from "@/layouts/CustomerWrapper";

import { ToastProvider } from "@/providers/ToastProvider";

const RiskMonitoring = () => {
	return (
		<CustomerWrapper>
			<ToastProvider />
		</CustomerWrapper>
	);
};

export default RiskMonitoring;
