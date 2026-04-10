import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { type LoginStore } from "./typings";

const useLoginStore = create<LoginStore>()(
	persist(
		(set) => ({
			token: "",
			setToken: (token: string) => {
				set(() => ({ token }));
			},
			email: "",
			setEmail: (email: string) => {
				set(() => ({ email }));
			},
		}),
		{
			name: "loginStore",
			storage: createJSONStorage(() => sessionStorage),
		},
	),
);

export default useLoginStore;
