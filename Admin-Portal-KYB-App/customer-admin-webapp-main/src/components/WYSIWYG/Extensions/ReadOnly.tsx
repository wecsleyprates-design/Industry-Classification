import { Node } from "@tiptap/core";

const ReadOnlyText = Node.create({
	name: "readOnlyText",
	group: "inline",
	inline: true,
	atom: true, // Makes it an atomic unit

	addAttributes() {
		return {
			label: {
				default: "", // The visible text
			},
			value: {
				default: "", // The hidden value stored in the HTML
			},
		};
	},

	parseHTML() {
		return [
			{
				tag: "span[data-read-only-value]",
				getAttrs: (dom) => ({
					label: dom.getAttribute("data-label"),
					value: dom.getAttribute("data-value"),
				}),
			},
		];
	},
	// update html
	renderHTML({ HTMLAttributes }) {
		return [
			"span",
			// {
			//   "data-read-only-value": "",
			//   class: "read-only-text",
			// },
			HTMLAttributes.value, // Render the label as the visible content
		];
	},
	// to update text editor content
	addNodeView() {
		return ({ node, view, getPos }) => {
			const wrapper = document.createElement("span");
			wrapper.className = "handlebartext";
			wrapper.setAttribute("data-label", node.attrs.label);
			wrapper.setAttribute("data-value", node.attrs.value);

			const labelSpan = document.createElement("button");
			labelSpan.textContent = node.attrs.label; // Display the label to the user
			// labelSpan.className = "handlebartext";
			// Add an event listener to remove the node when the button is clicked
			labelSpan.addEventListener("click", (event) => {
				event.preventDefault();
				const pos = getPos();
				if (typeof pos === "number") {
					const transaction = view.state.tr.delete(pos, pos + 1);
					view.dispatch(transaction);
				}
			});

			const removeButton = document.createElement("button");
			removeButton.className = "remove-icon";
			removeButton.type = "button";
			removeButton.textContent = "✕";

			// Add an event listener to remove the node when the button is clicked
			removeButton.addEventListener("click", (event) => {
				event.preventDefault();
				const pos = getPos();
				if (typeof pos === "number") {
					const transaction = view.state.tr.delete(pos, pos + 1);
					view.dispatch(transaction);
				}
			});

			wrapper.appendChild(labelSpan);
			wrapper.appendChild(removeButton);

			return { dom: wrapper };
		};
	},
});

export default ReadOnlyText;
