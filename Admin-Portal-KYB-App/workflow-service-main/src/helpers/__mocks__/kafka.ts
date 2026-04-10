// Mock for Kafka helper
export const consumer = {
	init: jest.fn().mockResolvedValue(undefined),
	run: jest.fn().mockResolvedValue(undefined),
	commitOffsets: jest.fn().mockResolvedValue(undefined)
};

export const producer = {
	init: jest.fn().mockResolvedValue(undefined),
	send: jest.fn().mockResolvedValue(undefined)
};

export const confirmKafkaTopicsExist = jest.fn().mockResolvedValue(undefined);
