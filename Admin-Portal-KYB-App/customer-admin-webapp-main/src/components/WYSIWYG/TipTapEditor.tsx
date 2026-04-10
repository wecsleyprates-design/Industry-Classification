import { useEffect, useRef, useState } from "react";
import { type UseFormSetValue } from "react-hook-form";
import { Color } from "@tiptap/extension-color";
import Document from "@tiptap/extension-document";
import Link from "@tiptap/extension-link";
import ListItem from "@tiptap/extension-list-item";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { TextStyle } from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import ReadOnlyText from "./Extensions/ReadOnly";
import MenuBar from "./Header/Menu";
import "./styles.scss";

const extensions = [
	Color.configure({ types: [TextStyle.name, ListItem.name] }),
	TextStyle,
	StarterKit.configure({
		paragraph: false,
	}),
	Document,
	Paragraph,
	Text,
	Underline,
	Link.configure({
		openOnClick: true,
		autolink: true,
	}),
	ReadOnlyText,
];

/** Returns true if the editor HTML has no meaningful content (empty or only empty paragraph). */
function isEditorContentEmpty(html: unknown): boolean {
	const s = typeof html === "string" ? html : String(html ?? "");
	const trimmed = s.trim();
	if (trimmed === "") return true;
	// TipTap empty state: <p></p> or <p><br></p> (and possible whitespace)
	const stripped = trimmed.replace(/<[^>]+>/g, "").trim();
	return stripped === "";
}

interface Props {
	title: string;
	setValue: UseFormSetValue<any>;
	content?: any;
	showLinks: boolean;
	showOrderedList: boolean;
	showUnOrderedList: boolean;
	onlyTitle: boolean;
	showCopyHtml: boolean;
	personalizeBtnOrientation?: string;
	personalizeOptionsData: PersonalizeOptionsData[];
	showMenuBar?: boolean;
	/** Placeholder text shown when the editor is empty. No extra libraries required. */
	placeholder?: string;
	/** Max character count (plain text). Input beyond this is rejected. */
	maxLength?: number;
}

interface PersonalizeOptionsData {
	key: string;
	label: string;
	value: string;
	placeholder: string;
}

const TipTapEditor: React.FC<Props> = ({
	showLinks,
	showOrderedList,
	showUnOrderedList,
	onlyTitle,
	showCopyHtml,
	setValue,
	title,
	content,
	personalizeBtnOrientation,
	personalizeOptionsData,
	showMenuBar,
	placeholder,
	maxLength,
}) => {
	const [editorContent, setEditorContent] = useState(content);
	const lastValidContentRef = useRef<string | undefined>(content);

	const editor = useEditor({
		extensions,
		content: editorContent,
		onUpdate: ({ editor }) => {
			const newContent = editor.getHTML();
			const textLength = editor.getText().length;
			if (typeof maxLength === "number" && textLength > maxLength) {
				const prev = lastValidContentRef.current ?? "";
				editor.commands.setContent(prev, { emitUpdate: false });
				setEditorContent(prev);
				setValue(title, prev, { shouldDirty: true });
				return;
			}
			lastValidContentRef.current = newContent;
			setEditorContent(newContent);
			setValue(title, newContent, { shouldDirty: true });
		},
		editorProps: {
			handleDOMEvents: {
				keydown: (_, event) => {
					if (event.key === "Enter" && onlyTitle) {
						event.preventDefault();
						return true;
					}
					return false;
				},
			},
		},
	});

	useEffect(() => {
		if (content !== editorContent) {
			const value =
				typeof content === "string" ? content : String(content ?? "");
			setEditorContent(value);
			lastValidContentRef.current = value;
			if (editor) {
				editor.commands.setContent(value, { emitUpdate: false });
			}
		}
	}, [content]);

	const showPlaceholder =
		Boolean(placeholder) && isEditorContentEmpty(editorContent);

	return (
		<>
			<div
				className="border border-[#DFDFDF] rounded-lg tiptap ring-0"
				id="tiptap"
			>
				<div className="py-2.5 tiptap">
					{editor && (
						<div className="tiptap tiptap-editor-wrapper">
							{showMenuBar && (
								<MenuBar
									showLinks={showLinks}
									showOrderedList={showOrderedList}
									showUnOrderedList={showUnOrderedList}
									showCopyHtml={showCopyHtml}
									setValue={setValue}
									title={title}
									editor={editor}
									personalizeBtnOrientation={personalizeBtnOrientation}
									personalizeOptionsData={personalizeOptionsData}
									showPersonalize={false}
								/>
							)}

							<div className="tiptap-editor-with-placeholder">
								{showPlaceholder && (
									<div className="tiptap-placeholder" aria-hidden="true">
										{placeholder}
									</div>
								)}
								<EditorContent editor={editor} />
							</div>
						</div>
					)}
				</div>
			</div>
		</>
	);
};
export default TipTapEditor;
