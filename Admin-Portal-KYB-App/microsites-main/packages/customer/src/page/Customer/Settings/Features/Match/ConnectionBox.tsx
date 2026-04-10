import { useCheckConnectionStatus } from "@/hooks/useIntegrationSettings";
import ConnectionButton from "./ConnectionButton";

export default function ConnectionBox({ isLoading }: { isLoading: boolean }) {
	const { isLoadingConnectionStatus, connectionStatus } =
		useCheckConnectionStatus();

	return (
		<div className="w-full flex flex-col col-span-2 items-center rounded-md border border-gray-200 px-4 py-3">
			<div className="flex flex-row justify-between text-xs items-center w-full border-b border-gray-200 min-h-6 pb-3">
				<p className="text-xs font-medium text-gray-500 text-left">
					Connection Status:
				</p>
				<ConnectionButton
					isLoading={isLoading}
					status={connectionStatus.status}
					message={connectionStatus.message}
					isLoadingConnectionStatus={isLoadingConnectionStatus}
				/>
			</div>
			<div className="flex flex-row justify-between text-xs items-center w-full min-h-6 pt-3">
				<p className="text-xs font-medium text-gray-500 text-left">
					Certificate Expiry
				</p>
				<p className="text-xs font-medium text-gray-500 text-left">
					{typeof connectionStatus?.expiresAt === "string"
						? connectionStatus.expiresAt.split("T")[0]
						: "N/A"}
				</p>
			</div>
		</div>
	);
}
