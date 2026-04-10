import os
import boto3
import botocore
import json
from datetime import datetime, timedelta, date
import pandas as pd
import numpy

class IntegrationsData:
    def __init__(self, inputForScore):
        try:
           self.__prepare_for_s3(inputForScore)
        except Exception:
            raise
    
    def __prepare_for_s3(self, inputForScore):
        try:
            self.s3_bucket_name = os.environ.get("CONFIG_S3_INTEGRATIONS_DUMP", 'worthai-dev-integrations-dump-demo')

            self.s3_economics_key = 'economics/latest.json'

            # Retrieve AWS credentials from environment variables
            aws_access_key_id = os.environ.get('CONFIG_AWS_ACCESS_KEY_ID')
            aws_secret_access_key = os.environ.get('CONFIG_AWS_ACCESS_KEY_SECRET')
            region_name = 'us-east-1'

            #Check if the access key ID and secret access key are provided
            if aws_access_key_id is None or aws_secret_access_key is None:
                raise ValueError("AWS credentials not found in environment variables")

            session = boto3.Session(
                aws_access_key_id=aws_access_key_id,
                aws_secret_access_key=aws_secret_access_key,
                region_name=region_name
			)
            self.s3Client = session.client('s3')

            try:
                s3_economics_clientobj = self.s3Client.get_object(Bucket=self.s3_bucket_name, Key=self.s3_economics_key)
                s3_economics_clientdata = s3_economics_clientobj['Body'].read().decode('utf-8')
                self.economics_sheet = json.loads(s3_economics_clientdata) 
                print('Fetched Economics data sheet from:'+ self.s3_economics_key)
            except Exception as be:
                print(be)
                print("Error Fetching Economics Data from:" + self.s3_economics_key)
                self.economics_sheet = {}

        except Exception:
            raise


    def get_economics_data(self):
        try:
            return self.economics_sheet
        except Exception:
            raise
        
