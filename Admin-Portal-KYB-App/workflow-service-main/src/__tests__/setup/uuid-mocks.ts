jest.mock("uuid", () => ({
	v4: jest.fn(() => "mock-uuid-v4"),
	validate: jest.fn(() => true),
	version: jest.fn(() => 4)
}));
