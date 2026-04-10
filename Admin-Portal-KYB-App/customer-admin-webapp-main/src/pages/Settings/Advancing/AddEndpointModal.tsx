import React, { useEffect, useMemo, useState } from "react";
import Button from "@/components/Button";
import Modal from "@/components/Modal";
import useCustomToast from "@/hooks/useCustomToast";
import { type GetWebhookEventsData } from "@/types/webhooks";

type Props = {
	isOpen: boolean;
	onClose: () => void;
	onSuccess: (item?: any) => void;
	setItems: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
	eventList: GetWebhookEventsData[] | undefined;
	itemsAdded?: Record<string, boolean>;
	isEdit?: boolean;
};

const AddEndpointModal = ({
	isOpen,
	onClose,
	onSuccess,
	setItems,
	eventList,
	itemsAdded,
	isEdit,
}: Props) => {
	const { errorHandler } = useCustomToast();
	const [selectAll, setSelectAll] = useState<Record<string, boolean>>({});
	const [activeTab, setActiveTab] = useState<string>("default");
	const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

	const selectedTabItems = useMemo(
		() =>
			eventList?.find((tab) => tab.category_code === activeTab)?.events || [],
		[eventList, activeTab],
	);

	const handleSelectAll = () => {
		const selectedTabItems =
			eventList?.find((tab) => tab.category_code === activeTab)?.events ?? [];

		const updatedCheckedItems = selectedTabItems.reduce<
			Record<string, boolean>
		>((acc, item) => {
			acc[item.code] = !selectAll[activeTab];
			return acc;
		}, {});
		const dataChecked = { ...checkedItems, ...updatedCheckedItems };
		setCheckedItems((prevItems) => ({
			...prevItems,
			...updatedCheckedItems,
		}));

		const trueVal = Object.keys(dataChecked)
			.filter((key) => dataChecked[key])
			.reduce((acc: any, key: any) => {
				acc[key] = dataChecked[key];
				return acc;
			}, {});

		setCheckedItems(trueVal);
		setSelectAll((prevItems) => ({
			...prevItems,
			[activeTab]: !selectAll[activeTab],
		}));
		eventList?.forEach((val) => {
			const lg = val.events.filter((value) => dataChecked[value.code]).length;
			if (lg === val.events.length) {
				setSelectAll((prevItems) => ({
					...prevItems,
					[val.category_code]: true,
				}));
			} else {
				setSelectAll((prevItems) => ({
					...prevItems,
					[val.category_code]: false,
				}));
			}
		});
	};

	const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setCheckedItems({
			...checkedItems,
			[e.target.name]: e.target.checked,
		});
		const dataChecked = { ...checkedItems, [e.target.name]: e.target.checked };

		const trueVal = Object.keys(dataChecked)
			.filter((key) => dataChecked[key])
			.reduce((acc: any, key: any) => {
				acc[key] = dataChecked[key];
				return acc;
			}, {});

		setCheckedItems(trueVal);

		checkSelectAll(e);
		if (!e.target.checked) {
			setSelectAll((prevItems) => ({
				...prevItems,
				[activeTab]: false,
			}));
		}
	};

	const checkSelectAll = (e?: React.ChangeEvent<HTMLInputElement>) => {
		const checkedItem = Object.keys(checkedItems).length
			? checkedItems
			: Object.keys(itemsAdded ?? {})?.length
				? itemsAdded
				: {};

		eventList?.forEach((val) => {
			const isActiveTab =
				val.events?.find((value) => value.code === e?.target.name) || false;
			let lg = val.events.filter((value) => checkedItem?.[value.code]).length;
			if (isActiveTab) {
				lg++;
			}
			if (lg === val.events.length) {
				setSelectAll((prevItems) => ({
					...prevItems,
					[val.category_code]: true,
				}));
			} else {
				setSelectAll((prevItems) => ({
					...prevItems,
					[val.category_code]: false,
				}));
			}
		});
	};

	useEffect(() => {
		if (itemsAdded) {
			setCheckedItems((prev) => {
				return { ...prev, ...itemsAdded };
			});
			checkSelectAll();
		}
	}, []);

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			cardColorClass="bg-transparent"
			type="Endpoint"
		>
			<div>
				<div className="p-1 bg-white border-b border-gray-200 rounded-t-3xl">
					<p className="m-4 ml-4 font-semibold text-md">Add Events</p>
				</div>
				<div className="justify-center block min-h-full px-5 py-6 bg-white border-b border-gray-200 sm:flex">
					<div className="flex flex-col w-full pb-4 sm:w-1/3 grow gap-y-3 ring-1 ring-white/10">
						{eventList?.map((option) => (
							<button
								key={option.category_code}
								className={`py-2 px-4 text-left font-sans ${
									activeTab === option.category_code
										? " text-blue-600 bg-blue-100 rounded-lg "
										: "text-gray-500 "
								}`}
								onClick={() => {
									setActiveTab(option.category_code);
									// setSelectAll(false); // Reset select all when changing tabs
									setSelectAll((prevItems) => ({
										...prevItems,
									}));
								}}
							>
								{option.category_label}
							</button>
						))}
					</div>
					<div className="w-full pl-4 ml-3 sm:w-2/3">
						<div className="mb-2">
							<div className="flex flex-row items-center mb-4 text-blue-600">
								<input
									type="checkbox"
									checked={selectAll[activeTab]}
									onChange={handleSelectAll}
									className="mr-1.5 h-5 w-5 cursor-pointer rounded-md accent-blue-600 text-slate-100"
								/>
								<div
									onClick={(e) => {
										e.stopPropagation();
									}}
									className="text-sm"
									style={{ cursor: "default" }}
								>
									{!selectAll[activeTab] ? "Select All" : "Deselect All"}
								</div>
							</div>

							{/* Render checkboxes for the selected tab */}
							{selectedTabItems.map((item) => (
								<div className="flex flex-row items-center mb-4" key={item.id}>
									<input
										type="checkbox"
										name={String(item.code)}
										checked={checkedItems[item.code] || false}
										onChange={handleCheckboxChange}
										className="mr-1.5 cursor-pointer rounded-md  accent-blue-600 text-slate-100 h-5 w-5"
									/>
									<div
										onClick={(e) => {
											e.stopPropagation();
										}}
										className="text-sm"
										style={{ cursor: "default" }}
									>
										{item.label}
									</div>
								</div>
							))}
						</div>
					</div>
				</div>

				<div className="justify-between w-full p-3 bg-white bolck sm:flex rounded-b-3xl">
					<div className="flex items-center m-1">
						<span className="px-3 py-2 text-blue-600 bg-blue-100 rounded-xl">
							{Object.values(checkedItems).filter((value) => value).length ??
								"0"}
						</span>
						<span className="p-2">Selected</span>
					</div>

					<div className="flex items-center m-1 mt-2 sm:mt-0">
						<span
							className="px-4 py-2 my-auto mr-3 text-sm font-medium text-blue-600 bg-white border border-gray-200 rounded-lg cursor-pointer hover:bg-slate-100"
							onClick={onClose}
						>
							Cancel
						</span>
						<Button
							color="blue"
							type="button"
							className="px-6 text-sm font-medium text-white rounded-lg hover:bg-blue-400"
							onClick={() => {
								if (Object.keys(checkedItems).length === 0) {
									errorHandler({
										message: "Please add at least 1 event to continue.",
										toastId: "selectEvent",
									});
									return;
								}
								if (isEdit) {
									onSuccess(checkedItems);
								} else onSuccess();
								if (!isEdit) onClose();
								setItems(checkedItems);
							}}
						>
							Apply
						</Button>
					</div>
				</div>
			</div>
		</Modal>
	);
};

export default AddEndpointModal;
