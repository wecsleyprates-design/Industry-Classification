import Tooltip from "../Tooltip";

type Prop = {
	text: string;
	textVisibleLength?: number;
};

const LongTextWrapper = ({ text, textVisibleLength = 20 }: Prop) => {
	return (
		<span className="text-wrapper">
			<span className="hidden 2xl:block">{text}</span>
			<span className="2xl:hidden">
				{" "}
				{text?.length < textVisibleLength ? (
					<>{text}</>
				) : (
					<Tooltip tooltip={text}>
						{`${text?.slice(0, textVisibleLength)}...`}
					</Tooltip>
				)}
			</span>
		</span>
	);
};

export default LongTextWrapper;
