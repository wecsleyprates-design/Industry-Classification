import { capitalize } from "@/lib/helper";
import {
	type AddressSource,
	type AddressVerificationReviewTask,
	type BaseReviewTask,
	type BusinessNameDetails,
	type BusinessNameReviewTask,
	type Name,
	type Person,
	type Registration,
	type WatchlistHitDetails,
	type WatchlistReviewTask,
} from "@/types/businessEntityVerification";

export const getAddressVerificationReviewTask = (
	reviewTasks: BaseReviewTask[],
): AddressVerificationReviewTask | null => {
	const addressVerificationReviewTask =
		reviewTasks?.find(
			(reviewTask) => reviewTask.key === "address_verification",
		) ?? null;
	if (
		addressVerificationReviewTask &&
		addressVerificationReviewTask.key === "address_verification"
	) {
		return addressVerificationReviewTask as AddressVerificationReviewTask;
	}
	return null;
};

export const getRegisteredAgentReviewTask = (
	reviewTasks: BaseReviewTask[],
): BaseReviewTask | null => {
	const registerAgentReviewTask =
		reviewTasks?.find(
			(reviewTask) => reviewTask.key === "address_registered_agent",
		) ?? null;
	if (
		registerAgentReviewTask &&
		registerAgentReviewTask.key === "address_registered_agent"
	) {
		return registerAgentReviewTask;
	}
	return null;
};

export const getWatchlistReviewTask = (
	reviewTasks: BaseReviewTask[],
): WatchlistReviewTask | null => {
	const watchlistReviewTask =
		reviewTasks?.find((reviewTask) => reviewTask.key === "watchlist") ?? null;
	if (watchlistReviewTask && watchlistReviewTask.key === "watchlist") {
		return watchlistReviewTask as WatchlistReviewTask;
	}
	return null;
};

export const getWatchlistHits = (
	reviewTasks: BaseReviewTask[],
): WatchlistHitDetails[] => {
	const watchlistReviewTask = getWatchlistReviewTask(reviewTasks);
	if (watchlistReviewTask) {
		return watchlistReviewTask.metadata.map(({ metadata }) => metadata);
	}
	return [];
};

export const titleExistsInWatchlistHits = (
	title: string,
	hits: WatchlistHitDetails[],
) => {
	const hitCount = hits.filter(
		(hit) => hit.title.toLocaleLowerCase() === title.toLocaleLowerCase(),
	).length;
	const titleExists = hitCount > 0;
	return {
		titleExists,
		hitCount,
	};
};

export const getBusinessReviewTask = (
	reviewTasks: BaseReviewTask[],
): BusinessNameReviewTask | null => {
	const businessReviewTask =
		reviewTasks?.find((reviewTask) => reviewTask.key === "name") ?? null;
	if (businessReviewTask && businessReviewTask.key === "name") {
		return businessReviewTask as BusinessNameReviewTask;
	}
	return null;
};

export const getBusinessNameMatches = (
	reviewTasks: BaseReviewTask[],
	names?: Name[],
): BusinessNameDetails[] => {
	if (names && names.length > 0) {
		return names.map((n) => ({
			name: n.name,
			submitted: n.submitted,
		}));
	}

	const businessReviewTask = getBusinessReviewTask(reviewTasks);
	if (businessReviewTask) {
		return businessReviewTask.metadata.map(({ metadata }) => metadata);
	}
	return [];
};

export const getSortedRegistrations = (registrations: Registration[]) =>
	[...registrations].sort(
		(a, b) =>
			new Date(a.registration_date).getTime() -
			new Date(b.registration_date).getTime(),
	);

export const getSortedAddressSources = (addressSources: AddressSource[]) =>
	[...addressSources].sort(
		(a, b) =>
			new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
	);

export const getSortedRegistrationsWithOfficers = (
	registrations: Registration[],
	peoples: Person[],
) => {
	const peopleMap = new Map<
		string,
		Array<{ name: string; titles: string[] }>
	>();

	peoples.forEach((person) => {
		person.source.forEach((source) => {
			if (peopleMap.has(source.id)) {
				peopleMap
					.get(source.id)
					?.push({ name: person.name, titles: person.titles });
			} else {
				peopleMap.set(source.id, [
					{ name: person.name, titles: person.titles },
				]);
			}
		});
	});

	const updatedRegistrations = registrations.map((registration) => {
		const people = peopleMap.get(registration?.external_id);
		const nameList: string[] = [];

		if (people) {
			people.forEach((person) => {
				person.titles.forEach((title) => {
					const capitalizedName = capitalize(person.name);
					const capitalizedTitle = capitalize(title);
					nameList.push(`${capitalizedName} - ${capitalizedTitle}`);
				});
			});
		}

		return {
			...registration,
			people: nameList,
		};
	});

	return updatedRegistrations.sort(
		(a, b) =>
			new Date(a.registration_date).getTime() -
			new Date(b.registration_date).getTime(),
	);
};
