import React from "react";
import { SparklesIcon, XMarkIcon } from "@heroicons/react/20/solid";
import newCaseImage from "@/assets/png/newcases.png";
import Modal from "@/components/Modal";

const CaseManagementV2Modal: React.FC<{
	isOpen: boolean;
	onClose: () => void;
	handleUpgrade?: () => Promise<void>;
}> = ({ isOpen, onClose, handleUpgrade }) => {
	const features = [
		{
			title: "New Overview Page",
			description:
				"Get a birdseye view of each case and download a full report in one click.",
		},
		{
			title: "Upgraded Crosswalking Tech",
			description: "Increased pre-filling and data accuracy.",
		},
		{
			title: "A New KYC Tab",
			description:
				"A dedicated section for IDV, fraud, and ownership verification.",
		},
	];
	return (
		<>
			<Modal
				isOpen={isOpen}
				onClose={onClose}
				cardColorClass="bg-white rounded-xl sm:max-w-[860px] p-0 m-0 sm:m-0 sm:p-0"
			>
				<div>
					{/* Bottom gradient background */}
					<div className="absolute h-[520px]  -translate-x-[170px] -translate-y-40 w-full bg-gradient-to-r to-[#f9f8fd] from-[#F3F5FF] -z-20 rotate-[-28deg]"></div>
					{/* Top gradient background */}
					<div className="top-0 absolute h-[500px] w-full -translate-y-[270px]  translate-x-20 bg-gradient-to-tl from-[#eff2fd] to-[#F6F3FE] -z-10 rotate-[30deg]"></div>

					<div className="relative flex justify-end p-3 py-5 bg-white">
						<button onClick={onClose}>
							<XMarkIcon className="text-[#1F2937] h-5 w-5 mr-2" />
						</button>
					</div>
					<div className="grid grid-cols-2">
						<div className="p-8">
							<h2 className="text-[#1F2937] text-4xl font-semibold">
								Case Management
							</h2>

							<h1 className="text-7xl font-semibold leading-tight tracking-tight px-1 bg-gradient-to-r from-[#33CCFF] to-[#FF66CC] bg-clip-text text-transparent inline-block">
								Reimagined
							</h1>
							<p className="mt-4 text-[#6B7280] text-sm font-normal">
								We’ve upgraded the case management interface to make it easier
								for you to manage your cases and make decisions. Here are just a
								few of the many highlights of the new experience:
							</p>

							<ul>
								{features.map((item) => (
									<li
										key={item.title}
										className="flex items-start gap-2 mt-4 text-sm"
									>
										<SparklesIcon className="w-[21px] h-[21px] text-[#2563EB]" />
										<div className="flex flex-col">
											<span className="text-[#1F2937]">{item.title}</span>
											<span className="text-[#6B7280] text-xs">
												{item.description}
											</span>
										</div>
									</li>
								))}
							</ul>
						</div>
						<div className="flex items-center justify-end p-0 m-0">
							<img
								src={newCaseImage}
								alt="New Case Management"
								className="flex w-full h-full text-end"
							/>
						</div>
					</div>

					<div className="flex justify-end gap-4 px-6 py-4 bg-white border-t">
						<button
							onClick={onClose}
							className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md"
						>
							Close
						</button>
						{handleUpgrade ? (
							<button
								onClick={handleUpgrade}
								className="bg-[#3B82F6] text-white px-4 py-2 rounded-md text-sm"
							>
								Upgrade Now
							</button>
						) : null}
					</div>
				</div>
			</Modal>
		</>
	);
};

export default CaseManagementV2Modal;
