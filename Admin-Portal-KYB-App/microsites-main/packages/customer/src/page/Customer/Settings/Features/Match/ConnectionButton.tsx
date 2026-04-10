export default function ConnectionButton({
	isLoading,
	status,
	message,
	isLoadingConnectionStatus,
}: {
	isLoading: boolean;
	status: string;
	message: string;
	isLoadingConnectionStatus: boolean;
}) {
	if (isLoadingConnectionStatus || isLoading) {
		return (
			<p className="bg-[#FEF9C3] text-[#A16207] px-2 py-1 rounded-md spinner">
				Checking Connection...
			</p>
		);
	}
	if (status === "error") {
		return (
			<p className="bg-[#FEF2F2] text-[#DC2626] px-2 py-1 rounded-md">
				{message}
			</p>
		);
	}
	if (status === "connected") {
		return (
			<p className="bg-[#DCFCE7] text-[#15803D] px-2 py-1 rounded-md">
				Connected
			</p>
		);
	}
	if (status === "not-connected") {
		return (
			<p className="bg-[#FEF9C3] text-[#A16207] px-2 py-1 rounded-md">
				Not Connected
			</p>
		);
	}
	if (status === "expired") {
		return (
			<p className="bg-[#FEF2F2] text-[#DC2626] px-2 py-1 rounded-md">
				Expired
			</p>
		);
	}
	return null;
}
