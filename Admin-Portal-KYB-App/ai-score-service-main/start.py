#!/usr/bin/env python
from scoretrigger import ScoreTrigger
from aiscore import AIScore
import os
from os.path import join, dirname
from dotenv import load_dotenv
import sys
import time
from kafkaproducer import KafkaProducer
import traceback
import json

def get_traceback(e):
    lines = traceback.format_exception(type(e), e, e.__traceback__)
    return ''.join(lines)


def main():  
    dotenv_path = join(dirname(__file__), '.env')
    load_dotenv(dotenv_path)
    kafkaPublisherObj = KafkaProducer()
    try:
        print ("Starting")
        sys.stdout.flush()
        scoreTriggerObj = ScoreTrigger()
        scoreTriggerObj.subscribeAndGenerateScores()   
        # event = {
        # "business_id": "7699524d-8b82-47d8-ae61-0e4d7ec57fdf1",
        # "score_trigger_id": "bbde8bb6-316f-4121-ac77-f17c35a0e8ea"
        # }
        # scoreTriggerObj.localTesting(event)
    except ValueError as valueError:
        print("Pushing to DLQ")
        errorDetails = {
            'payload': valueError.args[0],
            'error': get_traceback(valueError),
            'topic': valueError.args[1], #os.environ.get("CONFIG_KAFKA_AI_SCORE_TOPIC")
            'outcome': 'failure'
        }
        print(errorDetails)
        kafkaPublisherObj.publish(os.environ.get("CONFIG_KAFKA_AI_SCORE_DLQ_TOPIC"),os.environ.get("CONFIG_KAFKA_AI_GENERATE_SCORE_EVENT"),json.dumps(errorDetails))
        kafkaPublisherObj.publish(os.environ.get("CONFIG_KAFKA_AI_SCORE_DLQ_DATAPLATFORM_TOPIC"),os.environ.get("CONFIG_KAFKA_AI_GENERATE_SCORE_EVENT"),json.dumps(errorDetails))
    except Exception as e:
        print(e)
        #raise
    finally:
        print ("Something went wrong, looping back main")
        sys.stdout.flush()
        time.sleep(10)
        main()

if __name__ == "__main__":
    main()