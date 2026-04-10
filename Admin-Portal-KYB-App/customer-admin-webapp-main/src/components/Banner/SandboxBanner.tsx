import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/solid";
import { capitalize } from "@/lib/helper";
import useAuthStore from "@/store/useAuthStore";
import Banner from "../Banner";
import Button from "../Button";
import SwitchCustomerModal from "../Modal/SwitchCustomerModal";

import { MODULES } from "@/constants/Modules";

interface Props {
	customerName?: string;
	customerType?: string;
}

const SandboxBanner: React.FC<Props> = ({ customerName, customerType }) => {
	const [modalOpen, setModalOpen] = useState(false);
	const location = useLocation();

	const permissions = useAuthStore((state) => state.permissions);

	return (
		<>
			<Banner
				type="info-blue"
				className="flex flex-col items-start gap-y-3 sm:gap-y-0 sm:flex-row sm:items-center sm:justify-between w-full px-6 py-3 sm:px-8 bg-blue-100 text-blue-600 font-semibold rounded-none"
			>
				<div className="text-sm text-blue-700">
					{customerName}
					{" / "}
					{customerType && <span>{capitalize(customerType)} Mode</span>}
				</div>

				<div className="flex flex-wrap gap-2 sm:flex-nowrap sm:gap-3">
					<Button
						color="white"
						outline
						className="flex items-center px-3 space-x-1 border border-blue-600 text-blue-600 rounded-lg h-9"
						onClick={() =>
							window.open("https://docs.worthai.com/introduction", "_blank")
						}
					>
						<span className="font-medium">Documentation</span>
						<ArrowTopRightOnSquareIcon className="w-4 h-4 font-medium" />
					</Button>

					{permissions[MODULES.SETTINGS]?.read &&
						!location.pathname.startsWith("/settings") && (
							<Link to="/settings">
								<Button
									color="white"
									outline
									className="flex items-center px-3 space-x-1 border border-blue-600 text-blue-600 rounded-lg h-9 w-full sm:w-auto"
								>
									<span>Settings</span>
								</Button>
							</Link>
						)}

					<Button
						color="white"
						outline
						className="flex items-center px-3 space-x-1 border border-blue-600 text-blue-600 rounded-lg h-9 sm:w-auto"
						onClick={() => {
							setModalOpen(true);
						}}
					>
						<span>Switch Account</span>
					</Button>
				</div>
			</Banner>

			{/* Modal */}
			{modalOpen && (
				<SwitchCustomerModal
					isOpen={modalOpen}
					onClose={() => {
						setModalOpen(false);
					}}
				/>
			)}
		</>
	);
};

export default SandboxBanner;
