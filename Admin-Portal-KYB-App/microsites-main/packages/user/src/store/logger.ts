import { type StateCreator, type StoreMutatorIdentifier } from "zustand";

type Logger = <
	T,
	Mps extends Array<[StoreMutatorIdentifier, unknown]> = [],
	Mcs extends Array<[StoreMutatorIdentifier, unknown]> = [],
>(
	f: StateCreator<T, Mps, Mcs>,
	name?: string,
) => StateCreator<T, Mps, Mcs>;

type LoggerImpl = <T>(
	f: StateCreator<T, [], []>,
	name?: string,
) => StateCreator<T, [], []>;

const loggerImpl: LoggerImpl = (f, name) => (set, get, store) => {
	const loggedSet = (...a: Parameters<typeof set>) => {
		set(...a);
	};
	store.setState = loggedSet as typeof set;

	return f(loggedSet as typeof set, get, store);
};

export const logger = loggerImpl as Logger;
