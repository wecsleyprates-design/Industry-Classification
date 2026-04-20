<!-- Source: https://docs.worthai.com/api-reference/worth-360-report/check-worth-360-report-generation-status.md -->
# Check Worth 360 Report Generation Status

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.worthai.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Check Worth 360 Report Generation Status



## OpenAPI

````yaml get /reports/businesses/{businessID}/status
openapi: 3.1.0
info:
  title: For Customer's Businesses Worth 360 Report APIs
  contact: {}
  version: '1.0'
servers:
  - url: https://api.joinworth.com/report/api/v1
    variables: {}
security: []
tags:
  - name: Misc
    description: ''
paths:
  /reports/businesses/{businessID}/status:
    parameters: []
    get:
      tags:
        - Misc
      summary: Check Worth 360 Report Generation Status
      operationId: CheckWorth360ReportGenerationStatus
      parameters:
        - name: businessID
          in: path
          description: ''
          required: true
          style: simple
          schema:
            type: string
            examples:
              - 26a5d832-3f4e-4b43-84f2-e19c594bd7c1
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
                  example: Fri, 11 Apr 2025 09:34:22 GMT
            Content-Length:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: '423'
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
                  example: W/"1a7-SI0Rf9rRITDITRPjkDP5dUvWgn4"
            Keep-Alive:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: timeout=5
          content:
            application/json; charset=utf-8:
              schema:
                allOf:
                  - $ref: >-
                      #/components/schemas/REQUESTEDWorth360ReportGenerationStatusFetchedSuccessfully
                  - examples:
                      - status: success
                        message: Report status fetched successfully
                        data:
                          report_details:
                            id: 06cf2b4b-51fc-4e7f-8f60-e2c2ab161f23
                            report_type_id: 1
                            log: null
                            created_at: '2025-04-10T10:41:50.398Z'
                            created_by: fe879c59-f9e4-4796-9a63-38927541f0d7
                            updated_at: '2025-04-10T10:41:50.398Z'
                            triggered_by: CUSTOMER
                            triggered_id: 815f078a-2bc7-4fa9-84cb-b4e0c62a504f
                            status: REQUESTED
                          status: REQUESTED
                contentMediaType: application/json; charset=utf-8
              example:
                status: success
                message: Report status fetched successfully
                data:
                  report_details:
                    id: 06cf2b4b-51fc-4e7f-8f60-e2c2ab161f23
                    report_type_id: 1
                    log: null
                    created_at: '2025-04-10T10:41:50.398Z'
                    created_by: fe879c59-f9e4-4796-9a63-38927541f0d7
                    updated_at: '2025-04-10T10:41:50.398Z'
                    triggered_by: CUSTOMER
                    triggered_id: 815f078a-2bc7-4fa9-84cb-b4e0c62a504f
                    status: REQUESTED
                  status: REQUESTED
      deprecated: false
      security:
        - bearer: []
components:
  schemas:
    REQUESTEDWorth360ReportGenerationStatusFetchedSuccessfully:
      title: REQUESTEDWorth360ReportGenerationStatusFetchedSuccessfully
      type: object
      properties:
        status:
          type: string
        message:
          type: string
        data:
          $ref: '#/components/schemas/Data'
      examples:
        - status: success
          message: Report status fetched successfully
          data:
            report_details:
              id: 06cf2b4b-51fc-4e7f-8f60-e2c2ab161f23
              report_type_id: 1
              log: null
              created_at: '2025-04-10T10:41:50.398Z'
              created_by: fe879c59-f9e4-4796-9a63-38927541f0d7
              updated_at: '2025-04-10T10:41:50.398Z'
              triggered_by: CUSTOMER
              triggered_id: 815f078a-2bc7-4fa9-84cb-b4e0c62a504f
              status: REQUESTED
            status: REQUESTED
    Data:
      title: Data
      type: object
      properties:
        report_details:
          $ref: '#/components/schemas/ReportDetails'
        status:
          type: string
      examples:
        - report_details:
            id: 06cf2b4b-51fc-4e7f-8f60-e2c2ab161f23
            report_type_id: 1
            log: null
            created_at: '2025-04-10T10:41:50.398Z'
            created_by: fe879c59-f9e4-4796-9a63-38927541f0d7
            updated_at: '2025-04-10T10:41:50.398Z'
            triggered_by: CUSTOMER
            triggered_id: 815f078a-2bc7-4fa9-84cb-b4e0c62a504f
            status: REQUESTED
          status: REQUESTED
    ReportDetails:
      title: ReportDetails
      type: object
      properties:
        id:
          type: string
        report_type_id:
          type: integer
          contentEncoding: int32
        log:
          type:
            - string
            - 'null'
        created_at:
          type: string
        created_by:
          type: string
        updated_at:
          type: string
        triggered_by:
          type: string
        triggered_id:
          type: string
        status:
          type: string
      examples:
        - id: 06cf2b4b-51fc-4e7f-8f60-e2c2ab161f23
          report_type_id: 1
          log: null
          created_at: '2025-04-10T10:41:50.398Z'
          created_by: fe879c59-f9e4-4796-9a63-38927541f0d7
          updated_at: '2025-04-10T10:41:50.398Z'
          triggered_by: CUSTOMER
          triggered_id: 815f078a-2bc7-4fa9-84cb-b4e0c62a504f
          status: REQUESTED
  securitySchemes:
    bearer:
      type: http
      scheme: bearer

````