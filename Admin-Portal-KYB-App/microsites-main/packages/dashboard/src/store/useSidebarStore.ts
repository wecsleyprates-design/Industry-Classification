import { create } from "zustand";
import { type sideBarStore } from "./typings";

const useSidebarStore = create<sideBarStore>((set) => ({
	sidebarOpen: false,
	setSidebarOpen: (sidebarOpen: boolean) => {
		set(() => ({ sidebarOpen }));
	},
}));

export default useSidebarStore;
