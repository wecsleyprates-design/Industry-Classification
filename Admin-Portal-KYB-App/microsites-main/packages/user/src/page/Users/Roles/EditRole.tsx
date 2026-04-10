import React, { useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { useCustomToast } from "@/hooks";
import { UserWrapper } from "@/layouts/UserWrapper";
import { getItem } from "@/lib/localStorage";
import {
	useDeleteRole,
	useGetSubroleConfigs,
	useUpdateRole,
} from "@/services/queries/roles.query";
import ManageRoles from "./ManageRoles";

import { LOCALSTORAGE } from "@/constants";

const EditRole = () => {
	const { id } = useParams();
	const navigate = useNavigate();
	const { successToast, errorToast } = useCustomToast();

	const customerId: string = getItem(LOCALSTORAGE.customerId) ?? "";
	const { data: subroleConfigs } = useGetSubroleConfigs(id ?? "");

	const {
		mutateAsync: updateRole,
		data: updateRoleData,
		isPending,
		error: updateRoleError,
	} = useUpdateRole();

	const {
		mutateAsync: deleteRole,
		data: deleteRoleData,
		error: deleteRoleError,
	} = useDeleteRole();

	const handleEditRole = async (roleData: any) => {
		await updateRole({
			customerId,
			subroleId: id ?? "",
			roleData,
		});
	};

	const handleDeleteRole = async () => {
		if (id) {
			await deleteRole({ customerId, subroleId: id });
		}
	};

	useEffect(() => {
		if (updateRoleData) {
			successToast(
				updateRoleData.message ??
					updateRoleData?.data?.message ??
					"Role updated successfully",
			);
			setTimeout(() => {
				navigate(-1);
			}, 2000);
		}
	}, [updateRoleData]);

	useEffect(() => {
		if (updateRoleError) {
			errorToast(updateRoleError);
		}
	}, [updateRoleError]);

	useEffect(() => {
		if (deleteRoleData) {
			successToast(
				deleteRoleData.message ??
					deleteRoleData?.data?.message ??
					"Role deleted successfully",
			);
			setTimeout(() => {
				navigate(-1);
			}, 2000);
		}
	}, [deleteRoleData]);

	useEffect(() => {
		if (deleteRoleError) {
			errorToast(deleteRoleError);
		}
	}, [deleteRoleError]);

	return (
		<UserWrapper>
			<ManageRoles
				data={subroleConfigs}
				onSubmit={handleEditRole}
				isLoading={isPending}
				pageTitle="Manage Role"
				showDeleteButton
				onDelete={handleDeleteRole}
			/>
		</UserWrapper>
	);
};

export default EditRole;
