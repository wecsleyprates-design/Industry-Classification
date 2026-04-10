import React, { useEffect, useState } from "react";
import { generatePath, useNavigate } from "react-router";
import { isAdminSubdomain } from "@/lib/helper";
import { getItem, setItem } from "@/lib/localStorage";
import { useGetCustomerUsers } from "@/services/queries/user.query";
import {
	type GetCustomerUsersParams,
	type GetCustomerUsersResponse,
} from "@/types/GetCustomerUsers";
import { UserTable } from "./UserTable";

import { LOCALSTORAGE, URL } from "@/constants";

type Props = {
	customerId?: string;
	customerName?: string;
};

const CustomerUserTable: React.FC<Props> = ({
	customerId: propCustomerId,
	customerName,
}) => {
	// Read customerId directly from localStorage on each render (exactly like RolesTable)
	// Prefer prop if provided (e.g. from worth-admin)
	const customerId =
		propCustomerId ?? getItem<string>(LOCALSTORAGE.customerId) ?? "";

	const navigate = useNavigate();

	const [params, setParams] = useState<GetCustomerUsersParams>({
		owner_required: true,
	});

	// Reset params when customerId changes to avoid using stale filters from previous customer
	useEffect(() => {
		setParams({
			owner_required: true,
		});
	}, [customerId]);

	// The hook has `enabled: !!customerId` internally, so no API call is made when customerId is empty
	const { data, isLoading, isInitialLoading } = useGetCustomerUsers(
		customerId,
		params,
	);

	return (
		<UserTable<GetCustomerUsersParams, GetCustomerUsersResponse>
			data={data as GetCustomerUsersResponse | undefined}
			isLoading={isLoading}
			isInitialLoading={isInitialLoading}
			getDetailURL={(id) =>
				generatePath(URL.USER_DETAILS, { slug: customerId, id })
			}
			onCreateClick={() => {
				if (isAdminSubdomain(window.location.href) && customerId) {
					if (customerName) {
						setItem("customerName", customerName);
					}
					navigate(
						generatePath(URL.CREATE_CUSTOMER_USER, { slug: customerId }),
					);
				} else {
					navigate(URL.CREATE_USER);
				}
			}}
			onUpdateParams={(newParams) => {
				setParams({
					...newParams,
					owner_required: newParams.owner_required ?? true,
				});
			}}
		/>
	);
};

export default CustomerUserTable;
