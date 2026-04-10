export interface LoginStore {
	token: string;
	setToken: (token: string) => void;
	email: string;
	setEmail: (email: string) => void;
}

export interface WebsiteStore {
	website: string;
	setWebsite: (password: string) => void;
}
export interface sideBarStore {
	sidebarOpen: boolean;
	setSidebarOpen: (sidebarOpen: boolean) => void;
}
