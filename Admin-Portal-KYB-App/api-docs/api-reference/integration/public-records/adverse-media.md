<!-- Source: https://docs.worthai.com/api-reference/integration/public-records/adverse-media.md -->
# Adverse Media

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.worthai.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Adverse Media

> Retrieve adverse media associated with a particular businessID



## OpenAPI

````yaml get /business/{businessID}/adverse-media
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
  /business/{businessID}/adverse-media:
    parameters: []
    get:
      tags:
        - Adverse Media
      summary: Adverse Media
      description: Retrieve adverse media associated with a particular businessID
      operationId: AdverseMedia
      parameters:
        - name: businessID
          in: path
          description: ''
          required: true
          style: simple
          schema:
            type: string
            examples:
              - aabbccdd-eeff-aabb-ccdd-eeffaabbccdd
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
                  - $ref: '#/components/schemas/Success25'
                  - examples:
                      - status: success
                        message: Adverse Media data fetched successfully
                        data:
                          id: aabbccdd-eeff-aabb-ccdd-eeffaabbccdd
                          business_id: aabbccdd-eeff-aabb-ccdd-eeffaabbccdd
                          total_risk_count: 1
                          high_risk_count: 0
                          medium_risk_count: 0
                          low_risk_count: 1
                          average_risk_score: '3'
                          articles:
                            - id: aabbccdd-eeff-aabb-ccdd-eeffaabbccdd
                              title: Mother, Son Avoid Prison for Avon Mountain Crash
                              link: >-
                                https://www.nbcconnecticut.com/news/local/mom-son-to-be-sentenced-in-avon-mountain-crash/2063196/
                              date: '2009-06-30T07:00:00.000Z'
                              source: NBC Connecticut
                              entity_focus_score: 4
                              risk_level: LOW
                              risk_description: >-
                                Minimal adverse risk. The title suggests an
                                incident involving a mother and son avoiding
                                prison, with no direct mention of fraud, arrest,
                                or other high-risk keywords. The tone appears
                                neutral, and the focus is on individuals rather
                                than a business entity.
                              media_type: business
                              created_at: '2025-11-20T14:18:16.736Z'
                contentMediaType: application/json; charset=utf-8
              example:
                status: success
                message: Adverse Media data fetched successfully
                data:
                  id: aabbccdd-eeff-aabb-ccdd-eeffaabbccdd
                  business_id: aabbccdd-eeff-aabb-ccdd-eeffaabbccdd
                  total_risk_count: 4
                  high_risk_count: 0
                  medium_risk_count: 0
                  low_risk_count: 4
                  average_risk_score: '1'
                  created_at: '2025-02-18T11:39:46.750Z'
                  updated_at: '2025-02-18T11:39:46.750Z'
                  articles:
                    - id: aabbccdd-eeff-aabb-ccdd-eeffaabbccdd
                      title: >-
                        Genistein, a Natural Isoflavone, Alleviates
                        Seizure-Induced Respiratory Arrest in DBA/1 Mice
                      link: >-
                        https://www.frontiersin.org/journals/neurology/articles/10.3389/fneur.2021.761912/full
                      date: '2021-11-03T07:00:00.000Z'
                      source: Frontiers
                      entity_focus_score: 1
                      risk_level: LOW
                      risk_description: >-
                        The title does not contain any adverse keywords,
                        negative sentiment, or direct mention of the business
                        entity or individuals. It appears to be related to a
                        scientific study rather than an adverse media event.
                      created_at: '2025-02-18T11:39:46.750Z'
                      updated_at: '2025-02-18T11:39:46.750Z'
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
    Success25:
      title: Success25
      type: object
      properties:
        status:
          type: string
        message:
          type: string
        data:
          $ref: '#/components/schemas/Data106'
      examples:
        - status: success
          message: Adverse Media data fetched successfully
          data:
            id: aabbccdd-eeff-aabb-ccdd-eeffaabbccdd
            business_id: aabbccdd-eeff-aabb-ccdd-eeffaabbccdd
            total_risk_count: 4
            high_risk_count: 0
            medium_risk_count: 0
            low_risk_count: 4
            average_risk_score: '1'
            created_at: '2025-02-18T11:39:46.750Z'
            updated_at: '2025-02-18T11:39:46.750Z'
            articles:
              - id: aabbccdd-eeff-aabb-ccdd-eeffaabbccdd
                title: >-
                  Genistein, a Natural Isoflavone, Alleviates Seizure-Induced
                  Respiratory Arrest in DBA/1 Mice
                link: >-
                  https://www.frontiersin.org/journals/neurology/articles/10.3389/fneur.2021.761912/full
                date: '2021-11-03T07:00:00.000Z'
                source: Frontiers
                entity_focus_score: 1
                risk_level: LOW
                risk_description: >-
                  The title does not contain any adverse keywords, negative
                  sentiment, or direct mention of the business entity or
                  individuals. It appears to be related to a scientific study
                  rather than an adverse media event.
                created_at: '2025-02-18T11:39:46.750Z'
                updated_at: '2025-02-18T11:39:46.750Z'
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
    Data106:
      title: Data106
      type: object
      properties:
        id:
          type: string
        business_id:
          type: string
        total_risk_count:
          type: integer
          contentEncoding: int32
        high_risk_count:
          type: integer
          contentEncoding: int32
        medium_risk_count:
          type: integer
          contentEncoding: int32
        low_risk_count:
          type: integer
          contentEncoding: int32
        average_risk_score:
          type: string
        articles:
          type: array
          items:
            $ref: '#/components/schemas/Article'
          description: ''
      examples:
        - id: aabbccdd-eeff-aabb-ccdd-eeffaabbccdd
          business_id: aabbccdd-eeff-aabb-ccdd-eeffaabbccdd
          total_risk_count: 4
          high_risk_count: 0
          medium_risk_count: 0
          low_risk_count: 4
          average_risk_score: '1'
          created_at: '2025-02-18T11:39:46.750Z'
          updated_at: '2025-02-18T11:39:46.750Z'
          articles:
            - id: aabbccdd-eeff-aabb-ccdd-eeffaabbccdd
              title: >-
                Genistein, a Natural Isoflavone, Alleviates Seizure-Induced
                Respiratory Arrest in DBA/1 Mice
              link: >-
                https://www.frontiersin.org/journals/neurology/articles/10.3389/fneur.2021.761912/full
              date: '2021-11-03T07:00:00.000Z'
              source: Frontiers
              entity_focus_score: 1
              risk_level: LOW
              risk_description: >-
                The title does not contain any adverse keywords, negative
                sentiment, or direct mention of the business entity or
                individuals. It appears to be related to a scientific study
                rather than an adverse media event.
              created_at: '2025-02-18T11:39:46.750Z'
              updated_at: '2025-02-18T11:39:46.750Z'
            - id: aabbccdd-eeff-aabb-ccdd-eeffaabbccdd
              title: >-
                Microbiota-dependent indole production stimulates the
                development of collagen-induced arthritis in mice
              link: https://www.jci.org/articles/view/167671
              date: '2023-12-19T08:00:00.000Z'
              source: JCI
              entity_focus_score: 1
              risk_level: LOW
              risk_description: >-
                The title does not contain any high-risk keywords or negative
                sentiment related to the business entity or individuals
                mentioned. It appears to be a scientific study title unrelated
                to adverse media concerning the specified entities.
              created_at: '2025-02-18T11:39:46.750Z'
              updated_at: '2025-02-18T11:39:46.750Z'
            - id: aabbccdd-eeff-aabb-ccdd-eeffaabbccdd
              title: >-
                A fructosylated peptide derived from a collagen II T cell
                epitope for long-term treatment of arthritis (FIA-CIA) in mice
              link: https://www.nature.com/articles/s41598-021-95193-2
              date: '2021-08-30T07:00:00.000Z'
              source: Nature.com
              entity_focus_score: 1
              risk_level: LOW
              risk_description: >-
                The title does not contain any adverse keywords or negative
                sentiment. It appears to be related to a scientific study on
                arthritis treatment in mice, with no direct mention of the
                business entity or individuals.
              created_at: '2025-02-18T11:39:46.750Z'
              updated_at: '2025-02-18T11:39:46.750Z'
            - id: aabbccdd-eeff-aabb-ccdd-eeffaabbccdd
              title: >-
                Bone formation in the interphalangeal joint of male DBA/1 hind
                paw as...
              link: >-
                https://www.researchgate.net/figure/Bone-formation-in-the-interphalangeal-joint-of-male-DBA-1-hind-paw-as-assessed-by-X-ray_fig2_233957033
              date: '2018-06-11T23:02:00.000Z'
              source: ResearchGate
              entity_focus_score: 1
              risk_level: LOW
              risk_description: >-
                The title does not contain any adverse keywords, negative
                sentiment, or direct mention of the business entity or
                individuals. It appears to be related to a scientific or medical
                study rather than an adverse media event.
              created_at: '2025-02-18T11:39:46.750Z'
              updated_at: '2025-02-18T11:39:46.750Z'
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
    Article:
      title: Article
      type: object
      properties:
        id:
          type: string
        title:
          type: string
        link:
          type: string
        date:
          type: string
        source:
          type: string
        entity_focus_score:
          type: integer
          contentEncoding: int32
        risk_level:
          type: string
        risk_description:
          type: string
        created_at:
          type: string
        updated_at:
          type: string
      examples: []
  securitySchemes:
    bearer:
      type: http
      scheme: bearer

````

Built with [Mintlify](https://mintlify.com).