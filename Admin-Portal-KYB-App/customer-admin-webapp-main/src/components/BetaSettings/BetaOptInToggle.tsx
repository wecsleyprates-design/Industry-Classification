import React, { useState } from "react";
import { type FeatureKeyType } from "@/types/customer";
import Button from "../Button";
import Toggle from "../Input/Toggle";
import CaseManagementV2Modal from "./Modals/CaseManagementV2Modal";

interface BetaOptInToggleProps {
	title: string;
	description: string;
	featureKey: FeatureKeyType;
	value: boolean;
	onChange: (featureKey: FeatureKeyType, value: boolean) => Promise<void>;
}

const BetaOptInToggle: React.FC<BetaOptInToggleProps> = ({
	title,
	description,
	featureKey,
	value,
	onChange,
}) => {
	const [isOpen, setIsOpen] = useState(false);
	return (
		<div
			className="flex items-center justify-between p-4 mb-4 bg-[#FFFFFF] border rounded-2xl"
			key={featureKey}
		>
			<div className="items-center gap-x-2 md:flex">
				<div className="flex gap-x-2">
					<span className="text-sm font-medium text-[#1F2937]">{title}</span>
					<span className="text-xs px-2 py-0.5 rounded-full bg-[#6666CC] text-[#FFFFFF] font-medium">
						Beta
					</span>
				</div>
				<div className="flex items-center align-middle cursor-pointer gap-x-2">
					<span>•</span>
					<Button
						className="text-sm font-medium text-[#2563EB] p-0 hover:border-none hover:underline active:border-none focus:border-none"
						onClick={() => {
							setIsOpen(true);
						}}
					>
						{description}
					</Button>
				</div>
			</div>
			<div className="flex items-center">
				<div>
					<Toggle
						value={value}
						onChange={async () => {
							await onChange(featureKey, !value);
						}}
					/>
				</div>
			</div>
			{featureKey === "case_management_v2" && isOpen ? (
				<CaseManagementV2Modal
					isOpen={isOpen}
					onClose={() => {
						setIsOpen(false);
					}}
				/>
			) : null}
		</div>
	);
};

export default BetaOptInToggle;
