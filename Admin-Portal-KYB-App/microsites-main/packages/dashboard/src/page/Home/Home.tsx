import React, { type ComponentProps } from "react";
import { CRO } from "ui/cro";
import useAddClassName from "@/hooks/useAddClassName";
import { getItem } from "@/lib/localStorage";

// Only used for development purposes
const defaultCroProps: ComponentProps<typeof CRO> = {
	customerId: "",
	level: "cro",
	users: [
		{ id: "1", name: "Mark Lopez" },
		{ id: "2", name: "John Doe" },
		{ id: "3", name: "Jane Smith" },
	],
	tableData: [
		{
			caseNumber: "87900967...",
			date: "10/23/2024",
			type: "Risk",
			businessName: "Acme Corporation",
			worthScore: "728/850",
			status: "Needs Review",
			assignee: "Josh Smith",
		},
	],
};

const Home = () => {
	const customerId = getItem<string>("customerId");

	// use this hook to add dashboard class to the attributes which is not part of root.
	useAddClassName(["data-radix-popper-content-wrapper"]);

	if (!customerId) {
		return <div>No customer ID found</div>;
	}

	return (
		// added dashboard class here for tailwind css isolations to work
		<div className="dashboard">
			<CRO {...defaultCroProps} customerId={customerId} />
		</div>
	);
};

export default Home;
