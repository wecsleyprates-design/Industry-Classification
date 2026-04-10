import { CustomerWrapper } from "@/layouts/CustomerWrapper";
import { getItem } from "@/lib/localStorage";
import Notifications from "../Notifications";

import { LOCALSTORAGE } from "@/constants";
import { PLATFORM } from "@/constants/Platform";

const CustomerNotifications = () => {
	const customerId: string = getItem(LOCALSTORAGE.customerId) ?? "";
	return (
		<CustomerWrapper>
			<Notifications customerId={customerId} platform={PLATFORM.customer} />
		</CustomerWrapper>
	);
};

export default CustomerNotifications;
