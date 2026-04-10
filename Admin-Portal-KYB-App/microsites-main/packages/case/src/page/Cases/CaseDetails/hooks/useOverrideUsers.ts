import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { getUserByUserId } from "@/services/api/users.service";
import { useAppContextStore } from "@/store/useAppContextStore";

type FactsDataSource = Record<string, any> | undefined;

/**
 * Scans facts data sources for override.userID values, deduplicates them,
 * and batch-fetches user names via useQueries. Returns a Map<userID, displayName>.
 */
export function useOverrideUsers(
	factsDataSources: FactsDataSource[],
): Map<string, string> {
	const { customerId } = useAppContextStore();

	const uniqueUserIds = useMemo(() => {
		const ids = new Set<string>();
		for (const source of factsDataSources) {
			if (!source) continue;
			for (const key of Object.keys(source)) {
				if (key === "guest_owner_edits") continue;
				const fact = source[key];
				if (fact && typeof fact === "object" && "override" in fact) {
					const override = fact.override;
					if (override?.userID) {
						ids.add(String(override.userID));
					}
				}
			}
		}
		return Array.from(ids);
	}, [factsDataSources]);

	const userQueries = useQueries({
		queries: uniqueUserIds.map((userId) => ({
			queryKey: ["getUserByUserId", customerId, userId],
			queryFn: () => getUserByUserId(customerId, userId),
			enabled: !!customerId && !!userId,
			staleTime: 5 * 60 * 1000,
			retry: 1,
		})),
	});

	const userNameMap = useMemo(() => {
		const map = new Map<string, string>();
		for (let i = 0; i < uniqueUserIds.length; i++) {
			const result = userQueries[i];
			if (result?.data?.data) {
				const user = result.data.data;
				const name = [user.first_name, user.last_name]
					.filter(Boolean)
					.join(" ");
				if (name) {
					map.set(uniqueUserIds[i], name);
				}
			}
		}
		return map;
	}, [uniqueUserIds, userQueries]);

	return userNameMap;
}
