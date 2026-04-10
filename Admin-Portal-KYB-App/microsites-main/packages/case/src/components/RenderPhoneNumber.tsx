import React from "react";
import Flag from "react-world-flags";
import { type CountryCode } from "libphonenumber-js";
import { formatPhoneNumber } from "@/lib/utils";

import { VALUE_NOT_AVAILABLE } from "@/constants";

export interface RenderPhoneNumberProps {
	phoneNumber?: string | null;
	countryCode?: CountryCode;
}

const RenderPhoneNumber: React.FC<RenderPhoneNumberProps> = ({
	phoneNumber,
	countryCode,
}) => {
	return (
		<div className="flex items-center gap-2">
			{countryCode && phoneNumber ? (
				<Flag code={countryCode.toLowerCase()} className="h-5 w-7" />
			) : null}
			{phoneNumber
				? formatPhoneNumber(phoneNumber, countryCode)
				: VALUE_NOT_AVAILABLE}
		</div>
	);
};

export default RenderPhoneNumber;
