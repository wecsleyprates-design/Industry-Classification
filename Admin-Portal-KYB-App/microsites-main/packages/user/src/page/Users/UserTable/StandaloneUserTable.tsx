import React, { useState } from "react";
import { generatePath } from "react-router";
import { useGetUsers } from "@/services/queries/user.query";
import {
	type GetUsersQueryParams,
	type GetUsersResponse,
} from "@/types/GetUsers";
import { UserTable } from "./UserTable";

import { URL } from "@/constants";

export const StandaloneUserTable: React.FC = () => {
	const [params, setParams] = useState<GetUsersQueryParams>({});
	const { data, isLoading, isInitialLoading } = useGetUsers(params);

	return (
		<UserTable<GetUsersQueryParams, GetUsersResponse>
			data={data as GetUsersResponse | undefined}
			isLoading={isLoading}
			isInitialLoading={isInitialLoading}
			getDetailURL={(id) => generatePath(URL.STANDALONE_USER_DETAILS, { id })}
			onUpdateParams={setParams}
		/>
	);
};

export default StandaloneUserTable;
