export interface PanelProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	children?: React.ReactNode;
}
const Panel: React.FC<PanelProps> = ({ children, ...props }) => (
	<div className="overflow-hidden rounded-lg bg-white shadow">
		<div className="px-4 py-5 sm:p-6">{children}</div>
	</div>
);

export default Panel;
