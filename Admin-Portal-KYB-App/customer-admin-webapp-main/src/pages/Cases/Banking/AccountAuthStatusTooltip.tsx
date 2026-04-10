import { useId, useMemo } from "react";
import StatusBadge, { type Ttype } from "@/components/Badge/StatusBadge";
import { ReactCustomTooltip } from "@/components/Tooltip";

import { overrides } from "@/constants/Overrides";

const AccountAuthStatusTooltip = ({
	response,
	featureFlagEnabled,
}: {
	response?: {
		name: string | null;
		code: string | null;
		description: string | null;
		verification_response: string | null;
	} | null;
	featureFlagEnabled: boolean;
}) => {
	const { displayName, displayDescription, badgeType } = useMemo(() => {
		const override = featureFlagEnabled
			? overrides[response?.code ?? ""]
			: undefined;

		const name = override?.name || response?.name || "";
		const description = override?.description || response?.description || "";

		const type = ["Account Authenticated"].includes(name)
			? "green_tick"
			: ["Unauthenticated Account"].includes(name)
				? "warning"
				: "red_cross";

		return {
			displayName: name,
			displayDescription: description,
			badgeType: type,
		};
	}, [response?.code, response?.name, featureFlagEnabled]);

	const id = useId();

	if (!response?.name || !response?.code) return null;

	return (
		<ReactCustomTooltip
			id={`gauthenticate-tooltip-${id.replaceAll(/[^a-zA-Z0-9-_]/g, "")}`}
			tooltip={
				<>
					<strong>
						{`gAuthenticate Code & Response: ${response.code} - ${displayName}`}
					</strong>
					<br />
					{displayDescription}
				</>
			}
			place="right"
			tooltipStyle={{
				maxWidth: "400px",
				zIndex: 1000,
				fontSize: "12px",
			}}
		>
			<StatusBadge text={displayName} type={badgeType as Ttype} />
		</ReactCustomTooltip>
	);
};

export default AccountAuthStatusTooltip;
