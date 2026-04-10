import * as kafkaModule from "../kafka";

describe("Messaging Module", () => {
	it("exports initKafkaHandler", () => {
		expect(kafkaModule.initKafkaHandler).toBeDefined();
		expect(typeof kafkaModule.initKafkaHandler).toBe("function");
	});
});
