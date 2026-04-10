#!/usr/bin/env python
from confluent_kafka import Producer, Consumer, KafkaError, KafkaException
import os
class KafkaProducer:
    def __init__(self):
            try:
                environment = os.environ.get("PYTHON_ENV", "production")  # Default to production
                if environment == "production":
                    conf = {
                        'bootstrap.servers': os.environ.get("CONFIG_KAFKA_BROKERS", 'kafka:9092'),
                        'sasl.mechanism': 'SCRAM-SHA-512',  # Use SCRAM-SHA-512 mechanism
                        'security.protocol': 'SASL_SSL',
                        'sasl.username': os.environ.get("CONFIG_KAFKA_SASL_USERNAME", 'username'),
                        'sasl.password': os.environ.get("CONFIG_KAFKA_SASL_PASSWORD", 'password'),
                    }
                else:
                    conf = {
                        'bootstrap.servers': os.environ.get("CONFIG_KAFKA_BROKERS", 'kafka:9092'),
                        'security.protocol': 'PLAINTEXT',
                    }
                self.producer = Producer(**conf)
            except Exception as e:
                raise


    def publish(self, topic, key_event_name, event_value):
        try:
            def acked(err, msg):
                if err is not None:
                    print("Failed to deliver message: %s: %s" % (str(msg), str(err)))
                else:
                    print("Message produced: %s" % (str(msg)))
            self.producer.produce(topic, key=key_event_name, value=event_value, callback=acked)
            self.producer.flush()
        except Exception:
            raise
