import Spinner from "../Spinner";
import "./Loader.css";
type Props = {
	text?: string;
	loading?: boolean;
};

const Loader = ({ text, loading }: Props) => {
	const texts = text?.split(".");
	return (
		<div className="loading-screen">
			<Spinner />
			{texts?.map((text, index) => (
				<p key={index} className="loading-text">
					{text ?? "Loading..."}
				</p>
			))}
		</div>
	);
};

export default Loader;
