import { useEffect, useState } from "react";
import { getItem } from "@/lib/localStorage";
import { useGetBusinessesCustomFields } from "@/services/queries/businesses.query";
import { type Field } from "@/types/auth";
import CombineSendInviteForms from "./CombineSendInviteForms";

import { LOCALSTORAGE } from "@/constants/LocalStorage";

const SendInvitation = () => {
	const [customerId] = useState(getItem(LOCALSTORAGE?.customerId));

	const { data } = useGetBusinessesCustomFields(customerId ?? "");
	const [customFieldData, setCustomFieldData] = useState<Field[]>([]);

	useEffect(() => {
		if (data) {
			setCustomFieldData(data.data);
		}
	}, [data]);

	return (
		<>
			<CombineSendInviteForms customFieldsdata={{ fields: customFieldData }} />
		</>
	);
};

export default SendInvitation;
