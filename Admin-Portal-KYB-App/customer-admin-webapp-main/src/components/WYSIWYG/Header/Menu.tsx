import React, { useEffect, useState } from "react";
import { type UseFormSetValue } from "react-hook-form";
import { SwatchIcon } from "@heroicons/react/24/outline";
import { type Editor } from "@tiptap/react";
import BoldIcon from "@/assets/svg/WYSIWYGIcons/BoldIcon";
import ItalicIcon from "@/assets/svg/WYSIWYGIcons/ItalicIcon";
import LinkIcon from "@/assets/svg/WYSIWYGIcons/LinkIcon";
import OrderListIcon from "@/assets/svg/WYSIWYGIcons/OrderListIcon";
import StrikeIcon from "@/assets/svg/WYSIWYGIcons/StrikeIcon";
import UnderlineIcon from "@/assets/svg/WYSIWYGIcons/UnderlineIcon";
import UnorderedListIcon from "@/assets/svg/WYSIWYGIcons/UnorderedListIcon";
import Button from "@/components/Button";
import CustomPortal from "./CustomPortal";
import LinkModal from "./LinkModal";

interface Props {
	showLinks: boolean;
	showOrderedList: boolean;
	showUnOrderedList: boolean;
	setValue: UseFormSetValue<any>;
	title: string;
	editor: Editor;
	onlyTitle?: boolean;
	showCopyHtml?: boolean;
	personalizeOptionsData?: PersonalizeOptionsData[];
	personalizeBtnOrientation?: string;
	showPersonalize?: boolean;
}

interface PersonalizeOptionsData {
	key: string;
	label: string;
	value: string;
	placeholder: string;
}

const MenuBar: React.FC<Props> = ({
	showLinks,
	showOrderedList,
	showUnOrderedList,
	showCopyHtml,
	setValue,
	title,
	editor,
	personalizeBtnOrientation = "right-0",
	personalizeOptionsData = [
		{
			key: "my_business_name",
			label: "My Business Name",
			value: "{{business_name}}",
			placeholder: "Insert your own business's name.",
		},
		{
			key: "customer_name",
			label: "Customer Name",
			value: "{{customer_name}}",
			placeholder: "Insert the business name of the customer.",
		},
		{
			key: "applicant_first_name",
			label: "Applicant's First Name",
			value: "{{applicant_FirstName}}",
			placeholder: "Insert the first name Of the specific applicant.",
		},
		{
			key: "support_email",
			label: "Support Email",
			value: "{{support_email}}",
			placeholder: "Insert the support email of your own business.",
		},
		{
			key: "support_phone_number",
			label: "Support Phone Number",
			value: "{{support_phone_number}}",
			placeholder: "Insert the support phone number of your own business.",
		},
	],
	showPersonalize = true,
}) => {
	const [url, setUrl] = useState("");
	const [label, setLabel] = useState<any>("");

	// updated value basaed on html content
	useEffect(() => {
		if (editor) {
			setValue(title, editor.getHTML(), {
				shouldDirty: true,
				shouldValidate: true,
			});
		}
	}, [editor, title, setValue]);

	if (!editor) {
		return null;
	}

	const handleInsertNewText = ({
		label,
		value,
	}: {
		label: string;
		value: string;
	}) => {
		editor
			.chain()
			.setBold()
			.setItalic()
			.insertContent({
				type: "readOnlyText",
				attrs: {
					label,
					value,
				},
			})
			.run();
	};

	const PersonalizeOptions = personalizeOptionsData.map((item) => (
		<div
			key={item.key}
			className="flex cursor-pointer w-[250px] p-2 rounded-md pb-2 text-sm hover:bg-gray-100"
			onClick={() => {
				handleInsertNewText({ label: item.label, value: item.value });
			}}
		>
			<div className="">
				<h2 className="font-medium text-[#1F2937]">{item.label}</h2>
				<p className="text-[#6B7280]">{item.placeholder}</p>
			</div>
		</div>
	));

	const handleAddLink = () => {
		if (!editor) return;

		const previousUrl = editor.getAttributes("link").href;
		setUrl(previousUrl || "");

		const { from, to } =
			!editor.state.selection.empty && editor?.view
				? editor.view.state.selection
				: { from: 0, to: 0 };

		const selectedText = editor.state.doc.textBetween(from, to, " ");

		setLabel(selectedText);

		setLabel(selectedText);
	};

	const applyLink = () => {
		if (!url) return;
		let urlValue = url;
		if (!url.includes("http://") && !url.includes("https://")) {
			urlValue = `http://${url}`;
		}
		editor
			?.chain()
			.focus()
			.extendMarkRange("link")
			.setLink({ href: urlValue })
			.insertContent(label || url)
			.run();
	};

	const Buttons = [
		{
			title: "bold",
			icon: (
				<div className="items-center">
					<span className="text-lg text-gray-600">
						<BoldIcon />
					</span>
				</div>
			),
		},
		{
			title: "italic",
			icon: (
				<div className="items-center">
					<span className="text-lg text-gray-600">
						<ItalicIcon />
					</span>
				</div>
			),
		},
		{
			title: "underline",
			icon: (
				<div className="items-center">
					<span className="text-lg text-gray-600">
						<UnderlineIcon />
					</span>
				</div>
			),
		},
		{
			title: "strike",
			icon: (
				<div className="items-center">
					<span className="text-lg text-gray-600">
						<StrikeIcon />
					</span>
				</div>
			),
		},
		showLinks && {
			title: "link",
			icon: (
				<>
					<div className="items-center">
						<LinkIcon />
					</div>
				</>
			),
		},
		showUnOrderedList && {
			title: "bulletList",
			icon: (
				<>
					<div className="items-center ">
						<UnorderedListIcon />
					</div>
				</>
			),
		},
		showOrderedList && {
			title: "orderedList",
			icon: (
				<>
					<div className="items-center text-black">
						<OrderListIcon />
					</div>
				</>
			),
		},
	];

	return (
		<div className="px-4 tiptap">
			<div className="flex justify-between mt-2">
				<div className="flex ">
					{Buttons.filter((item) => typeof item !== "boolean").map((btn) => {
						return (
							<div key={btn.title}>
								{btn.title !== "link" ? (
									<button
										type="button"
										onClick={() => {
											if (btn.title === "bold")
												editor.chain().focus().toggleBold().run();
											else if (btn.title === "italic")
												editor.chain().focus().toggleItalic().run();
											else if (btn.title === "strike")
												editor.chain().focus().toggleStrike().run();
											else if (btn.title === "underline")
												editor.chain().focus().toggleUnderline().run();
											else if (btn.title === "bulletList")
												editor.chain().focus().toggleBulletList().run();
											else if (btn.title === "orderedList")
												editor.chain().focus().toggleOrderedList().run();
										}}
										className={`flex h-8 w-8 text-gray-800 mx-1 justify-center rounded-md hover:bg-gray-200 ${
											editor.isActive(btn.title) ? "bg-gray-200  " : ""
										}`}
									>
										<span className="content-center self-center justify-center text-center ">
											{btn.icon}
										</span>
									</button>
								) : (
									<CustomPortal
										component={
											<LinkModal
												url={url}
												setUrl={setUrl}
												label={label}
												setLabel={setLabel}
												applyLink={applyLink}
											/>
										}
									>
										<button
											onClick={handleAddLink}
											type="button"
											className={`flex h-8 w-8 text-gray-600 mx-1 justify-center rounded-md hover:bg-gray-200 ${
												editor.isActive(btn.title) ? "bg-gray-200  " : ""
											}`}
										>
											<span className="content-center self-center justify-center text-center ">
												{btn.icon}
											</span>
										</button>
									</CustomPortal>
								)}
							</div>
						);
					})}
				</div>

				{showPersonalize && (
					<div className="">
						<Button
							className="relative flex items-center content-center justify-start w-full h-8 px-2 text-sm text-gray-600 align-middle bg-white rounded-lg text-start sm:justify-center hover:bg-gray-200"
							dropdown={{
								chevron: false,
								divider: true,
								orientation: personalizeBtnOrientation,
								options: PersonalizeOptions,
							}}
							type="button"
						>
							<SwatchIcon className="w-4 h-4 font-bold text-gray-600 " />
							<span className="px-2">Personalize </span>
						</Button>
					</div>
				)}
			</div>
		</div>
	);
};

export default MenuBar;
