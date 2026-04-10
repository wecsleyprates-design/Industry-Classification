import { useId, useMemo } from "react";
import StatusBadge, { type Ttype } from "@/components/Badge/StatusBadge";
import { ReactCustomTooltip } from "@/components/Tooltip";

const AccountVerificationStatusTooltip = ({
	response,
}: {
	response?: {
		name: string | null;
		code: string | null;
		description: string | null;
		verification_response: string | null;
	} | null;
}) => {
	const { displayName, displayDescription, badgeType } = useMemo(() => {
		const name = response?.name || "";
		const description = response?.description || "";

		const type = ["Account Verified"].includes(name)
			? "green_tick"
			: ["Unverified Account", "No Information Found"].includes(name)
				? "warning"
				: "red_cross";

		return {
			displayName: name,
			displayDescription: description,
			badgeType: type,
		};
	}, [response?.code, response?.name]);

	const id = useId();

	if (!response?.name || !response?.code) return null;

	return (
		<ReactCustomTooltip
			id={`gverify-tooltip-${id.replaceAll(/[^a-zA-Z0-9-_]/g, "")}`}
			tooltip={
				<>
					<strong>
						{`gVerify Code & Response: ${response.code} - ${displayName}`}
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

export default AccountVerificationStatusTooltip;
