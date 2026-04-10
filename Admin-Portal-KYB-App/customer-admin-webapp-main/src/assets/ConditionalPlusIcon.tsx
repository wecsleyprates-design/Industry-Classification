const ConditionalPlusIcon = ({
	isNotapplicant,
}: {
	isNotapplicant: boolean;
}) => {
	if (isNotapplicant)
		return <span className="m-1 font-medium align-super">†</span>;
	else <></>;
};

export default ConditionalPlusIcon;
