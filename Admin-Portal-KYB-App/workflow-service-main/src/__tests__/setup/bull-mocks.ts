const mockQueue = {
	on: jest.fn(),
	add: jest.fn().mockResolvedValue({ id: "mock-job-id" }),
	process: jest.fn(),
	close: jest.fn().mockResolvedValue(undefined),
	isPaused: jest.fn().mockReturnValue(false),
	pause: jest.fn().mockResolvedValue(undefined),
	resume: jest.fn().mockResolvedValue(undefined),
	clean: jest.fn().mockResolvedValue([]),
	getJobs: jest.fn().mockResolvedValue([]),
	getJob: jest.fn().mockResolvedValue(null),
	removeJobs: jest.fn().mockResolvedValue(undefined),
	empty: jest.fn().mockResolvedValue(undefined),
	destroy: jest.fn().mockResolvedValue(undefined)
};

jest.mock("bull", () => {
	return jest.fn().mockImplementation(() => mockQueue);
});

export { mockQueue };
