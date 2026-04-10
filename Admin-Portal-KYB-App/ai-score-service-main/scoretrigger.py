from confluent_kafka import Producer, Consumer, KafkaError, KafkaException

import os
import time
import json
from preparedata import PrepareData
from aiscore import AIScore
import sys

class ScoreTrigger:
    def __init__(self):
        try:
            print("Initializing")
            # print(os.environ)
            sys.stdout.flush()
            self.prepareDataObj = PrepareData()
            self.AIScoreObj = AIScore()
        except Exception:
            raise

    def localTesting(self, inputForScore):
        try:
            prepareDataObj = PrepareData()
            preparedData = prepareDataObj.mappedData(inputForScore)
            probability = self.AIScoreObj.getScore(inputForScore=inputForScore, mappedData=preparedData)
            # print(probability)
        except Exception as e:
            raise ValueError(inputForScore, "localTesting") from e

    def subscribeAndGenerateScores(self):
        consumer = None
        try:
            consumer = Consumer(
                {
                    "bootstrap.servers": os.environ.get("CONFIG_KAFKA_BROKERS", "kafka:9092"),
                    "group.id": os.environ.get("CONFIG_KAFKA_CONSUMER_GROUP_ID", "username"),
                    "sasl.mechanism": "SCRAM-SHA-512",
                    "security.protocol": "SASL_SSL",
                    "sasl.username": os.environ.get("CONFIG_KAFKA_SASL_USERNAME", "username"),
                    "sasl.password": os.environ.get("CONFIG_KAFKA_SASL_PASSWORD", "password"),
                    "auto.offset.reset": "earliest",
                    "partition.assignment.strategy": "roundrobin",
                }
            )

            self.running = True
            consumer.subscribe([os.environ.get("CONFIG_KAFKA_AI_SCORE_TOPIC", "score-trigger")])

            expected_event = os.environ.get("CONFIG_KAFKA_AI_GENERATE_SCORE_EVENT")

            while self.running:
                msg = consumer.poll(5000.0)

                if msg is None:
                    continue

                if msg.error():
                    if msg.error().code() == KafkaError._PARTITION_EOF:
                        print("reached end at offset")
                        print(msg.topic())
                        print(msg.offset())
                        print(msg.partition())
                        sys.stdout.flush()
                        continue
                    raise KafkaException(msg.error())

                # ---- Decode key/value for visibility -----------------------------
                key = msg.key().decode("utf-8") if msg.key() else None

                raw_value_bytes = msg.value()
                raw_value_str = raw_value_bytes.decode("utf-8") if raw_value_bytes else ""

                print(f"Received message (topic={msg.topic()} partition={msg.partition()} offset={msg.offset()})")
                print(f"Kafka key: {key}")
                print(f"Raw payload:\n{raw_value_str}")

                # ---- Parse JSON payload and route by payload['event'] -----------
                try:
                    payload = json.loads(raw_value_str) if raw_value_str else {}
                except json.JSONDecodeError:
                    print("skipping message - payload is not valid JSON")
                    sys.stdout.flush()
                    continue

                payload_event = payload.get("event")
                print(f"Payload event: {payload_event}")

                if payload_event == expected_event:
                    self.__processScore(payload)
                else:
                    print("skipping message - event mismatch")

                sys.stdout.flush()

        except Exception:
            raise
        finally:
            if consumer is not None:
                consumer.close()

    def __processScore(self, payload):
        inputForScore = None
        try:
            # payload is already a dict from json.loads above
            inputForScore = payload

            preparedData = self.prepareDataObj.mappedData(inputForScore)
            print(preparedData)
            self.AIScoreObj.getProbabilityAndPublish(mappedData=preparedData, inputForScore=inputForScore)
        except Exception as e:
            raise ValueError(inputForScore, os.environ.get("CONFIG_KAFKA_AI_SCORE_TOPIC")) from e
