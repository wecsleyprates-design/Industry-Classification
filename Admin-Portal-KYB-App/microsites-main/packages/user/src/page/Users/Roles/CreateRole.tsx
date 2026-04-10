import React, { useEffect } from "react";
import { useNavigate } from "react-router";
import { useCustomToast } from "@/hooks";
import { UserWrapper } from "@/layouts/UserWrapper";
import { getItem } from "@/lib/localStorage";
import {
	useCreateRole,
	useGetSubroleConfigs,
} from "@/services/queries/roles.query";
import ManageRoles from "./ManageRoles";

import { LOCALSTORAGE } from "@/constants";

const CreateRole = () => {
	const navigate = useNavigate();
	const { successToast, errorToast } = useCustomToast();

	const customerId: string = getItem(LOCALSTORAGE.customerId) ?? "";
	const { data: subroleConfigs } = useGetSubroleConfigs();

	const {
		mutateAsync: createRole,
		data: createRoleData,
		isPending,
		error: createRoleError,
	} = useCreateRole();

	const handleCreateRole = async (roleData: any) => {
		await createRole({ customerId, roleData });
	};

	useEffect(() => {
		if (createRoleData) {
			successToast(
				createRoleData.message ??
					createRoleData?.data?.message ??
					"Role created successfully",
			);
			setTimeout(() => {
				navigate(-1);
			}, 2000);
		}
	}, [createRoleData]);

	useEffect(() => {
		if (createRoleError) {
			errorToast(createRoleError);
		}
	}, [createRoleError]);

	return (
		<UserWrapper>
			<ManageRoles
				data={subroleConfigs}
				onSubmit={handleCreateRole}
				isLoading={isPending}
				pageTitle="Create Role"
			/>
		</UserWrapper>
	);
};

export default CreateRole;
