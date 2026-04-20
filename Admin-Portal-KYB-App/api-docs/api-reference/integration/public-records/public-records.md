<!-- Source: https://docs.worthai.com/api-reference/integration/public-records/public-records.md -->
# Public Records

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.worthai.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Public Records

> Retrieve public records associated with a particular businessID



## OpenAPI

````yaml get /business/{businessID}/public-records
openapi: 3.1.0
info:
  title: Integration Service
  description: >-
    This service is responsible for all integrations and contains all
    integration information about the business.
  contact: {}
  version: '1.0'
servers:
  - url: https://api.joinworth.com/integration/api/v1
    variables: {}
  - url: http://localhost:3005/api/v1/accounting/taxStatus
    variables: {}
  - url: http://example.com
    variables: {}
  - url: http://localhost:3000/api/v1
    variables: {}
security: []
tags:
  - name: Banking
  - name: Financials
  - name: Accounting
  - name: Public Records
  - name: manual-filing
  - name: Taxation
  - name: OpenCorporates
  - name: ZoomInfo
  - name: Verification
  - name: Verification
  - name: FAQ Chatbot
  - name: Applicants
  - name: Extract Document Details
  - name: Charts / Stats
  - name: Credit Bureau (Equifax)
  - name: Insights
    description: >-
      AI Insights Assistant that can help generate an insights report.
      Additionally users can converse with a chatbot about their report.
  - name: Risk Alerts
  - name: Queue Management
  - name: Data Scrape
  - name: White Label
  - name: File Executions
  - name: Files
  - name: OCR
  - name: Customer Integration Settings
  - name: Facts
    description: >-
      Facts provide a common interface to pick the most authoritative values for
      attribues that may be sourced from different sources.


      E.g.: Which address do we surface as the primary address for a business?
      Determine that by collecting all addresses we have and returning the
      address with the highest degree of confidence.
  - name: Adverse Media
  - name: Misc
    description: ''
paths:
  /business/{businessID}/public-records:
    parameters: []
    get:
      tags:
        - Public Records
      summary: Public Records
      description: Retrieve public records associated with a particular businessID
      operationId: PublicRecords
      parameters:
        - name: businessID
          in: path
          description: ''
          required: true
          style: simple
          schema:
            type: string
            examples:
              - b355ee0d-318f-4b57-9ccb-864deaf298b5
      responses:
        '200':
          description: OK
          headers:
            Date:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: Fri, 28 Feb 2025 11:44:56 GMT
            Content-Length:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: '2676'
            Connection:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: keep-alive
            Content-Security-Policy:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: >-
                    default-src 'self';base-uri 'self';font-src 'self' https:
                    data:;form-action 'self';frame-ancestors 'self';img-src
                    'self' data:;object-src 'none';script-src
                    'self';script-src-attr 'none';style-src 'self' https:
                    'unsafe-inline';upgrade-insecure-requests
            Cross-Origin-Opener-Policy:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: same-origin
            Cross-Origin-Resource-Policy:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: same-origin
            Origin-Agent-Cluster:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: '?1'
            Referrer-Policy:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: no-referrer
            Strict-Transport-Security:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: max-age=15552000; includeSubDomains
            X-Content-Type-Options:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: nosniff
            X-DNS-Prefetch-Control:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: 'off'
            X-Download-Options:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: noopen
            X-Frame-Options:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: SAMEORIGIN
            X-Permitted-Cross-Domain-Policies:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: none
            X-XSS-Protection:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: '0'
            Vary:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: Origin
            Access-Control-Allow-Credentials:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: 'true'
            ETag:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: W/"a74-dx2D1mMtt2pAUoC43V3YleKQ8ys"
          content:
            application/json; charset=utf-8:
              schema:
                allOf:
                  - $ref: '#/components/schemas/Success11'
                  - examples:
                      - status: success
                        message: Success
                        data:
                          public_records:
                            id: 5aeef5b5-ff1b-4d22-9f53-152d8308028a
                            business_integration_task_id: b37f9dcb-31f8-49da-8c7e-3559bc397d8f
                            number_of_business_liens: '0'
                            most_recent_business_lien_filing_date: null
                            most_recent_business_lien_status: null
                            number_of_bankruptcies: '0'
                            most_recent_bankruptcy_filing_date: null
                            number_of_judgement_fillings: '0'
                            most_recent_judgement_filling_date: null
                            corporate_filing_business_name: null
                            corporate_filing_filling_date: null
                            corporate_filing_incorporation_state: null
                            corporate_filing_corporation_type: null
                            corporate_filing_resgistration_type: null
                            corporate_filing_secretary_of_state_status: null
                            corporate_filing_secretary_of_state_status_date: null
                            average_rating: '4.60'
                            created_at: '2025-01-10T09:53:47.916Z'
                            updated_at: '2025-01-10T09:53:47.916Z'
                            monthly_rating: '4.60'
                            monthly_rating_date: '2024-12-01T00:00:00.000Z'
                            official_website: null
                            reviews:
                              - source: Google
                                count: 584
                                percentage: '0'
                            review_statistics:
                              count_of_total_reviewers_all_time: 0
                              count_of_duplicate_reviewers_all_time: 0
                              min_rating_all_time: 0
                              median_rating_all_time: 0
                              max_rating_all_time: 0
                              standard_deviation_of_rating_all_time: 0
                              variance_of_rating_all_time: 0
                              count_of_0_or_1_star_ratings_all_time: 0
                              count_of_2_star_ratings_all_time: 0
                              count_of_3_star_ratings_all_time: 0
                              count_of_4_star_ratings_all_time: 0
                              count_of_5_star_ratings_all_time: 0
                              percentage_of_0_or_1_star_ratings_all_time: 0
                              percentage_of_2_star_ratings_all_time: 0
                              percentage_of_3_star_ratings_all_time: 0
                              percentage_of_4_star_ratings_all_time: 0
                              percentage_of_5_star_ratings_all_time: 0
                              count_of_reviews_containing_alert_words_all_time: 0
                              percentage_of_reviews_containing_alert_words_all_time: 0
                            compalint_statistics:
                              count_of_complaints_all_time: 0
                              count_of_consumer_financial_protection_bureau_complaints_all_time: 0
                              percentage_of_complaints_containing_alert_words_all_time: 0
                              count_of_federal_trade_commission_complaints_all_time: 0
                              count_of_answered_resolved_status_all_time: 0
                              percentage_of_answered_resolved_status_all_time: 0
                              count_of_resolved_resolved_status_all_time: 0
                              percentage_of_resolved_resolved_status_all_time: 0
                              count_of_unanswered_resolved_status_all_time: 0
                              percentage_of_unanswered_resolved_status_all_time: 0
                              count_of_unresolved_resolved_status_all_time: 0
                              percentage_of_unresolved_resolved_status_all_time: 0
                              count_of_other_resolved_status_all_time: 0
                              percentage_of_other_resolved_status_all_time: 0
                            additional_records:
                              minority_owned_enterprise: N/A
                              woman_owned_enterprise: N/A
                              veteran_owned_enterprise: N/A
                              number_of_employees: N/A
                contentMediaType: application/json; charset=utf-8
              example:
                status: success
                message: Success
                data:
                  public_records:
                    id: 5aeef5b5-ff1b-4d22-9f53-152d8308028a
                    business_integration_task_id: b37f9dcb-31f8-49da-8c7e-3559bc397d8f
                    number_of_business_liens: '0'
                    most_recent_business_lien_filing_date: null
                    most_recent_business_lien_status: null
                    number_of_bankruptcies: '0'
                    most_recent_bankruptcy_filing_date: null
                    number_of_judgement_fillings: '0'
                    most_recent_judgement_filling_date: null
                    corporate_filing_business_name: null
                    corporate_filing_filling_date: null
                    corporate_filing_incorporation_state: null
                    corporate_filing_corporation_type: null
                    corporate_filing_resgistration_type: null
                    corporate_filing_secretary_of_state_status: null
                    corporate_filing_secretary_of_state_status_date: null
                    average_rating: '4.60'
                    created_at: '2025-01-10T09:53:47.916Z'
                    updated_at: '2025-01-10T09:53:47.916Z'
                    monthly_rating: '4.60'
                    monthly_rating_date: '2024-12-01T00:00:00.000Z'
                    official_website: null
                    reviews:
                      - source: Google
                        count: 584
                        percentage: '0'
                    review_statistics:
                      count_of_total_reviewers_all_time: 0
                      count_of_duplicate_reviewers_all_time: 0
                      min_rating_all_time: 0
                      median_rating_all_time: 0
                      max_rating_all_time: 0
                      standard_deviation_of_rating_all_time: 0
                      variance_of_rating_all_time: 0
                      count_of_0_or_1_star_ratings_all_time: 0
                      count_of_2_star_ratings_all_time: 0
                      count_of_3_star_ratings_all_time: 0
                      count_of_4_star_ratings_all_time: 0
                      count_of_5_star_ratings_all_time: 0
                      percentage_of_0_or_1_star_ratings_all_time: 0
                      percentage_of_2_star_ratings_all_time: 0
                      percentage_of_3_star_ratings_all_time: 0
                      percentage_of_4_star_ratings_all_time: 0
                      percentage_of_5_star_ratings_all_time: 0
                      count_of_reviews_containing_alert_words_all_time: 0
                      percentage_of_reviews_containing_alert_words_all_time: 0
                    compalint_statistics:
                      count_of_complaints_all_time: 0
                      count_of_consumer_financial_protection_bureau_complaints_all_time: 0
                      percentage_of_complaints_containing_alert_words_all_time: 0
                      count_of_federal_trade_commission_complaints_all_time: 0
                      count_of_answered_resolved_status_all_time: 0
                      percentage_of_answered_resolved_status_all_time: 0
                      count_of_resolved_resolved_status_all_time: 0
                      percentage_of_resolved_resolved_status_all_time: 0
                      count_of_unanswered_resolved_status_all_time: 0
                      percentage_of_unanswered_resolved_status_all_time: 0
                      count_of_unresolved_resolved_status_all_time: 0
                      percentage_of_unresolved_resolved_status_all_time: 0
                      count_of_other_resolved_status_all_time: 0
                      percentage_of_other_resolved_status_all_time: 0
                    additional_records:
                      minority_owned_enterprise: N/A
                      woman_owned_enterprise: N/A
                      veteran_owned_enterprise: N/A
                      number_of_employees: N/A
        '403':
          description: Forbidden
          headers:
            Date:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: Fri, 28 Feb 2025 11:47:14 GMT
            Content-Length:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: '141'
            Connection:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: keep-alive
            Content-Security-Policy:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: >-
                    default-src 'self';base-uri 'self';font-src 'self' https:
                    data:;form-action 'self';frame-ancestors 'self';img-src
                    'self' data:;object-src 'none';script-src
                    'self';script-src-attr 'none';style-src 'self' https:
                    'unsafe-inline';upgrade-insecure-requests
            Cross-Origin-Opener-Policy:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: same-origin
            Cross-Origin-Resource-Policy:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: same-origin
            Origin-Agent-Cluster:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: '?1'
            Referrer-Policy:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: no-referrer
            Strict-Transport-Security:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: max-age=15552000; includeSubDomains
            X-Content-Type-Options:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: nosniff
            X-DNS-Prefetch-Control:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: 'off'
            X-Download-Options:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: noopen
            X-Frame-Options:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: SAMEORIGIN
            X-Permitted-Cross-Domain-Policies:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: none
            X-XSS-Protection:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: '0'
            Vary:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: Origin
            Access-Control-Allow-Credentials:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: 'true'
            ETag:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: W/"8d-OyL99VllE2DloZyRQezMnFz7VUc"
          content:
            application/json; charset=utf-8:
              schema:
                allOf:
                  - $ref: '#/components/schemas/Error1'
                  - examples:
                      - status: fail
                        message: You are not allowed to access the data.
                        errorCode: UNAUTHORIZED
                        data:
                          errorName: AccessMiddlewareError
                contentMediaType: application/json; charset=utf-8
              example:
                status: fail
                message: You are not allowed to access the data.
                errorCode: UNAUTHORIZED
                data:
                  errorName: AccessMiddlewareError
      deprecated: false
      security:
        - bearer: []
      servers:
        - url: https://api.joinworth.com/integration/api/v1
          variables: {}
components:
  schemas:
    Success11:
      title: Success11
      type: object
      properties:
        status:
          type: string
        message:
          type: string
        data:
          $ref: '#/components/schemas/Data20'
      examples:
        - status: success
          message: Success
          data:
            public_records:
              id: 5aeef5b5-ff1b-4d22-9f53-152d8308028a
              business_integration_task_id: b37f9dcb-31f8-49da-8c7e-3559bc397d8f
              number_of_business_liens: '0'
              most_recent_business_lien_filing_date: null
              most_recent_business_lien_status: null
              number_of_bankruptcies: '0'
              most_recent_bankruptcy_filing_date: null
              number_of_judgement_fillings: '0'
              most_recent_judgement_filling_date: null
              corporate_filing_business_name: null
              corporate_filing_filling_date: null
              corporate_filing_incorporation_state: null
              corporate_filing_corporation_type: null
              corporate_filing_resgistration_type: null
              corporate_filing_secretary_of_state_status: null
              corporate_filing_secretary_of_state_status_date: null
              average_rating: '4.60'
              created_at: '2025-01-10T09:53:47.916Z'
              updated_at: '2025-01-10T09:53:47.916Z'
              monthly_rating: '4.60'
              monthly_rating_date: '2024-12-01T00:00:00.000Z'
              official_website: null
              reviews:
                - source: Google
                  count: 584
                  percentage: '0'
              review_statistics:
                count_of_total_reviewers_all_time: 0
                count_of_duplicate_reviewers_all_time: 0
                min_rating_all_time: 0
                median_rating_all_time: 0
                max_rating_all_time: 0
                standard_deviation_of_rating_all_time: 0
                variance_of_rating_all_time: 0
                count_of_0_or_1_star_ratings_all_time: 0
                count_of_2_star_ratings_all_time: 0
                count_of_3_star_ratings_all_time: 0
                count_of_4_star_ratings_all_time: 0
                count_of_5_star_ratings_all_time: 0
                percentage_of_0_or_1_star_ratings_all_time: 0
                percentage_of_2_star_ratings_all_time: 0
                percentage_of_3_star_ratings_all_time: 0
                percentage_of_4_star_ratings_all_time: 0
                percentage_of_5_star_ratings_all_time: 0
                count_of_reviews_containing_alert_words_all_time: 0
                percentage_of_reviews_containing_alert_words_all_time: 0
              compalint_statistics:
                count_of_complaints_all_time: 0
                count_of_consumer_financial_protection_bureau_complaints_all_time: 0
                percentage_of_complaints_containing_alert_words_all_time: 0
                count_of_federal_trade_commission_complaints_all_time: 0
                count_of_answered_resolved_status_all_time: 0
                percentage_of_answered_resolved_status_all_time: 0
                count_of_resolved_resolved_status_all_time: 0
                percentage_of_resolved_resolved_status_all_time: 0
                count_of_unanswered_resolved_status_all_time: 0
                percentage_of_unanswered_resolved_status_all_time: 0
                count_of_unresolved_resolved_status_all_time: 0
                percentage_of_unresolved_resolved_status_all_time: 0
                count_of_other_resolved_status_all_time: 0
                percentage_of_other_resolved_status_all_time: 0
              additional_records:
                minority_owned_enterprise: N/A
                woman_owned_enterprise: N/A
                veteran_owned_enterprise: N/A
                number_of_employees: N/A
    Error1:
      title: Error1
      required:
        - status
        - message
        - errorCode
        - data
      type: object
      properties:
        status:
          type: string
        message:
          type: string
        errorCode:
          type: string
        data:
          $ref: '#/components/schemas/Data1'
      examples:
        - status: fail
          message: You are not allowed to access the data.
          errorCode: UNAUTHORIZED
          data:
            errorName: AccessMiddlewareError
    Data20:
      title: Data20
      type: object
      properties:
        public_records:
          $ref: '#/components/schemas/PublicRecords'
      examples:
        - public_records:
            id: 5aeef5b5-ff1b-4d22-9f53-152d8308028a
            business_integration_task_id: b37f9dcb-31f8-49da-8c7e-3559bc397d8f
            number_of_business_liens: '0'
            most_recent_business_lien_filing_date: null
            most_recent_business_lien_status: null
            number_of_bankruptcies: '0'
            most_recent_bankruptcy_filing_date: null
            number_of_judgement_fillings: '0'
            most_recent_judgement_filling_date: null
            corporate_filing_business_name: null
            corporate_filing_filling_date: null
            corporate_filing_incorporation_state: null
            corporate_filing_corporation_type: null
            corporate_filing_resgistration_type: null
            corporate_filing_secretary_of_state_status: null
            corporate_filing_secretary_of_state_status_date: null
            average_rating: '4.60'
            created_at: '2025-01-10T09:53:47.916Z'
            updated_at: '2025-01-10T09:53:47.916Z'
            monthly_rating: '4.60'
            monthly_rating_date: '2024-12-01T00:00:00.000Z'
            official_website: null
            reviews:
              - source: Google
                count: 584
                percentage: '0'
            review_statistics:
              count_of_total_reviewers_all_time: 0
              count_of_duplicate_reviewers_all_time: 0
              min_rating_all_time: 0
              median_rating_all_time: 0
              max_rating_all_time: 0
              standard_deviation_of_rating_all_time: 0
              variance_of_rating_all_time: 0
              count_of_0_or_1_star_ratings_all_time: 0
              count_of_2_star_ratings_all_time: 0
              count_of_3_star_ratings_all_time: 0
              count_of_4_star_ratings_all_time: 0
              count_of_5_star_ratings_all_time: 0
              percentage_of_0_or_1_star_ratings_all_time: 0
              percentage_of_2_star_ratings_all_time: 0
              percentage_of_3_star_ratings_all_time: 0
              percentage_of_4_star_ratings_all_time: 0
              percentage_of_5_star_ratings_all_time: 0
              count_of_reviews_containing_alert_words_all_time: 0
              percentage_of_reviews_containing_alert_words_all_time: 0
            compalint_statistics:
              count_of_complaints_all_time: 0
              count_of_consumer_financial_protection_bureau_complaints_all_time: 0
              percentage_of_complaints_containing_alert_words_all_time: 0
              count_of_federal_trade_commission_complaints_all_time: 0
              count_of_answered_resolved_status_all_time: 0
              percentage_of_answered_resolved_status_all_time: 0
              count_of_resolved_resolved_status_all_time: 0
              percentage_of_resolved_resolved_status_all_time: 0
              count_of_unanswered_resolved_status_all_time: 0
              percentage_of_unanswered_resolved_status_all_time: 0
              count_of_unresolved_resolved_status_all_time: 0
              percentage_of_unresolved_resolved_status_all_time: 0
              count_of_other_resolved_status_all_time: 0
              percentage_of_other_resolved_status_all_time: 0
            additional_records:
              minority_owned_enterprise: N/A
              woman_owned_enterprise: N/A
              veteran_owned_enterprise: N/A
              number_of_employees: N/A
    Data1:
      title: Data1
      required:
        - errorName
      type: object
      properties:
        errorName:
          type: string
      examples:
        - errorName: BankingApiError
    PublicRecords:
      title: PublicRecords
      type: object
      properties:
        id:
          type: string
        business_integration_task_id:
          type: string
        number_of_business_liens:
          type: string
        most_recent_business_lien_filing_date:
          type:
            - string
            - 'null'
        most_recent_business_lien_status:
          type:
            - string
            - 'null'
        number_of_bankruptcies:
          type: string
        most_recent_bankruptcy_filing_date:
          type:
            - string
            - 'null'
        number_of_judgement_fillings:
          type: string
        most_recent_judgement_filling_date:
          type:
            - string
            - 'null'
        corporate_filing_business_name:
          type:
            - string
            - 'null'
        corporate_filing_filling_date:
          type:
            - string
            - 'null'
        corporate_filing_incorporation_state:
          type:
            - string
            - 'null'
        corporate_filing_corporation_type:
          type:
            - string
            - 'null'
        corporate_filing_resgistration_type:
          type:
            - string
            - 'null'
        corporate_filing_secretary_of_state_status:
          type:
            - string
            - 'null'
        corporate_filing_secretary_of_state_status_date:
          type:
            - string
            - 'null'
        average_rating:
          type: string
        created_at:
          type: string
        updated_at:
          type: string
        monthly_rating:
          type: string
        monthly_rating_date:
          type: string
        official_website:
          type:
            - string
            - 'null'
        reviews:
          type: array
          items:
            $ref: '#/components/schemas/Review'
          description: ''
        review_statistics:
          $ref: '#/components/schemas/ReviewStatistics'
        compalint_statistics:
          $ref: '#/components/schemas/CompalintStatistics'
        additional_records:
          $ref: '#/components/schemas/AdditionalRecords'
    Review:
      title: Review
      type: object
      properties:
        source:
          type: string
        count:
          type: integer
          contentEncoding: int32
        percentage:
          type: string
      examples:
        - source: Google
          count: 584
          percentage: '0'
    ReviewStatistics:
      title: ReviewStatistics
      type: object
      properties:
        count_of_total_reviewers_all_time:
          type: integer
          contentEncoding: int32
        count_of_duplicate_reviewers_all_time:
          type: integer
          contentEncoding: int32
        min_rating_all_time:
          type: integer
          contentEncoding: int32
        median_rating_all_time:
          type: integer
          contentEncoding: int32
        max_rating_all_time:
          type: integer
          contentEncoding: int32
        standard_deviation_of_rating_all_time:
          type: integer
          contentEncoding: int32
        variance_of_rating_all_time:
          type: integer
          contentEncoding: int32
        count_of_0_or_1_star_ratings_all_time:
          type: integer
          contentEncoding: int32
        count_of_2_star_ratings_all_time:
          type: integer
          contentEncoding: int32
        count_of_3_star_ratings_all_time:
          type: integer
          contentEncoding: int32
        count_of_4_star_ratings_all_time:
          type: integer
          contentEncoding: int32
        count_of_5_star_ratings_all_time:
          type: integer
          contentEncoding: int32
        percentage_of_0_or_1_star_ratings_all_time:
          type: integer
          contentEncoding: int32
        percentage_of_2_star_ratings_all_time:
          type: integer
          contentEncoding: int32
        percentage_of_3_star_ratings_all_time:
          type: integer
          contentEncoding: int32
        percentage_of_4_star_ratings_all_time:
          type: integer
          contentEncoding: int32
        percentage_of_5_star_ratings_all_time:
          type: integer
          contentEncoding: int32
        count_of_reviews_containing_alert_words_all_time:
          type: integer
          contentEncoding: int32
        percentage_of_reviews_containing_alert_words_all_time:
          type: integer
          contentEncoding: int32
    CompalintStatistics:
      title: CompalintStatistics
      type: object
      properties:
        count_of_complaints_all_time:
          type: integer
          contentEncoding: int32
        count_of_consumer_financial_protection_bureau_complaints_all_time:
          type: integer
          contentEncoding: int32
        percentage_of_complaints_containing_alert_words_all_time:
          type: integer
          contentEncoding: int32
        count_of_federal_trade_commission_complaints_all_time:
          type: integer
          contentEncoding: int32
        count_of_answered_resolved_status_all_time:
          type: integer
          contentEncoding: int32
        percentage_of_answered_resolved_status_all_time:
          type: integer
          contentEncoding: int32
        count_of_resolved_resolved_status_all_time:
          type: integer
          contentEncoding: int32
        percentage_of_resolved_resolved_status_all_time:
          type: integer
          contentEncoding: int32
        count_of_unanswered_resolved_status_all_time:
          type: integer
          contentEncoding: int32
        percentage_of_unanswered_resolved_status_all_time:
          type: integer
          contentEncoding: int32
        count_of_unresolved_resolved_status_all_time:
          type: integer
          contentEncoding: int32
        percentage_of_unresolved_resolved_status_all_time:
          type: integer
          contentEncoding: int32
        count_of_other_resolved_status_all_time:
          type: integer
          contentEncoding: int32
        percentage_of_other_resolved_status_all_time:
          type: integer
          contentEncoding: int32
    AdditionalRecords:
      title: AdditionalRecords
      type: object
      properties:
        minority_owned_enterprise:
          type: string
        woman_owned_enterprise:
          type: string
        veteran_owned_enterprise:
          type: string
        number_of_employees:
          type: string
  securitySchemes:
    bearer:
      type: http
      scheme: bearer

````