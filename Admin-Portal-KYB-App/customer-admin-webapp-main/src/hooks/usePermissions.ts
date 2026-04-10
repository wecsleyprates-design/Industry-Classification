import { getPermissions } from "@/lib/helper";
import { getItem } from "@/lib/localStorage";
import { type IPermission } from "@/types/auth";

const useGetPermissions = (module: string) => {
	const permissions: IPermission[] = getItem("permissions") ?? [];

	const val = getPermissions(permissions, module);
	return val;
};

export default useGetPermissions;
