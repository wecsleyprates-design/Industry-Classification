import { twMerge } from "tailwind-merge";

type Props = {
	active?: boolean;
	onOpenSwitchModal?: () => void;
};

const SwitchCustomers = ({ active, onOpenSwitchModal }: Props) => {
	return (
		<button
			type="button"
			onClick={onOpenSwitchModal}
			className={twMerge(
				"block w-full px-4 py-2 text-left text-sm cursor-pointer",
				active ? "bg-gray-50 text-gray-900" : "text-gray-700",
			)}
		>
			Switch Accounts
		</button>
	);
};

export default SwitchCustomers;
