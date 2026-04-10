import { useState } from "react";
import {
	ChevronDownIcon,
	ChevronUpIcon,
	CreditCardIcon,
} from "@heroicons/react/24/outline";
import Button from "@/components/Button";
import SelectComponent from "@/components/Dropdown/SelectComponent";
import Match from "./Match/Match";

interface Props {
	customerId?: string;
}

const CustomFeatures: React.FC<Props> = () => {
	const [expandedFeatures, setExpandedFeatures] = useState<string[]>([]);
	const [selectedOption, setSelectedOption] = useState<Record<string, string>>({
		match_pro: "enabled",
	});

	const toggleFeatureCard = (key: string) => {
		setExpandedFeatures((prev) =>
			prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
		);
	};

	const features = [
		{
			key: "match_pro",
			name: "Match PRO",
			description: "Support identity verification and risk assessment.",
			icon: <CreditCardIcon className="w-6 h-6 text-blue-600" />,
		},
	];

	const options = [
		{ label: "Live Data", value: "live" },
		{ label: "Disable", value: "disabled" },
	];

	return (
		<div className="overflow-visible bg-white border rounded-xl mb-7 mr-4 px-4 py-1">
			<div className="px-5">
				<div className="flex items-start justify-between">
					<div>
						<div className="mt-1 text-base font-semibold">Custom Features</div>
						<div className="mt-2 text-sm font-normal text-gray-500">
							The features below can be configured with your own existing
							credentials.
						</div>
					</div>
				</div>

				{features.map(({ key, name, description, icon }) => (
					<div key={key} className="flex flex-col">
						{/* Feature Row */}
						<div className="flex justify-between">
							<div className="flex items-start my-4 mt-6 mr-2 gap-3 min-w-0">
								<div className="flex items-center justify-center h-10 rounded-lg min-w-10 bg-blue-50 flex-shrink-0">
									{icon}
								</div>

								<div className="flex-1 min-w-0">
									<h2 className="text-sm text-[#1F2937] font-medium mb-1">
										{name}
									</h2>
									<p className="text-sm text-gray-500">{description}</p>
								</div>
							</div>

							{/* Right side: Dropdown + Manage button */}
							<div className="flex items-center mt-4 space-x-3">
								<div className="w-40">
									<SelectComponent
										showDot
										value={
											options.find(
												(opt) => opt.value === selectedOption[key],
											) ?? { label: "Disabled", value: "disable" }
										}
										options={options}
										onChange={(option) => {
											if (!option) return;
											setSelectedOption((prev) => ({
												...prev,
												[key]: option.value,
											}));
										}}
										defaultValue={{
											value: undefined,
											label: "",
										}}
										customStyles={{
											control: (provided: any, state: any) => ({
												...provided,
												height: 45,
												fontSize: "14px",
												fontWeight: 500,
												borderRadius: "8px",
												borderColor: state.isFocused ? "#4B5563" : "#e5e7e8",
												boxShadow: "none",
												"&:hover": {
													borderColor: "#9ca3af",
												},
											}),
										}}
									/>
								</div>

								<Button
									type="button"
									color={"white"}
									onClick={() => {
										toggleFeatureCard(key);
									}}
									className="flex items-center gap-2 px-4 py-3 text-sm rounded-md h-45 hover:border-gray-600"
								>
									Manage
									{expandedFeatures.includes(key) ? (
										<ChevronUpIcon className="w-4 h-4 text-gray-400" />
									) : (
										<ChevronDownIcon className="w-4 h-4 text-gray-400" />
									)}
								</Button>
							</div>
						</div>

						{expandedFeatures.includes(key) && (
							<div className="w-full px-14 pb-6">
								<Match />
							</div>
						)}
					</div>
				))}
			</div>
		</div>
	);
};

export default CustomFeatures;
