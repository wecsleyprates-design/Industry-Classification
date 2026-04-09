<!-- Source: https://docs.worthai.com/api-reference/worth-360-report/get-worth-360-report-details.md -->
# Get Worth 360 Report Details

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.worthai.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Get Worth 360 Report Details

> ### Get Report by ID

This endpoint retrieves a specific report based on the provided report ID.

#### Request

No request body is required for this endpoint.

- `reportID` (path parameter) - The ID of the report to be retrieved.
    

#### Response

The response will be a JSON object with the following schema:

``` json
{
  "type": "object",
  "properties": {
    "status": {
      "type": "string"
    },
    "message": {
      "type": "string"
    },
    "data": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string"
        },
        "report_type_id": {
          "type": "integer"
        },
        "status": {
          "type": "string"
        },
        "log": {
          "type": ["string", "null"]
        },
        "created_at": {
          "type": "string"
        },
        "created_by": {
          "type": "string"
        },
        "updated_at": {
          "type": "string"
        },
        "triggered_by": {
          "type": "string"
        },
        "triggered_id": {
          "type": "string"
        },
        "report_type": {
          "type": "object",
          "properties": {
            "core_report_types": {
              "type": "object",
              "properties": {
                "id": {
                  "type": "integer"
                },
                "code": {
                  "type": "string"
                },
                "label": {
                  "type": "string"
                }
              }
            }
          }
        }
      }
    }
  }
}

 ```



## OpenAPI

````yaml get /reports/{reportID}
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
  /reports/{reportID}:
    parameters: []
    get:
      tags:
        - Misc
      summary: Get Worth 360 Report Details
      description: >-
        ### Get Report by ID


        This endpoint retrieves a specific report based on the provided report
        ID.


        #### Request


        No request body is required for this endpoint.


        - `reportID` (path parameter) - The ID of the report to be retrieved.
            

        #### Response


        The response will be a JSON object with the following schema:


        ``` json

        {
          "type": "object",
          "properties": {
            "status": {
              "type": "string"
            },
            "message": {
              "type": "string"
            },
            "data": {
              "type": "object",
              "properties": {
                "id": {
                  "type": "string"
                },
                "report_type_id": {
                  "type": "integer"
                },
                "status": {
                  "type": "string"
                },
                "log": {
                  "type": ["string", "null"]
                },
                "created_at": {
                  "type": "string"
                },
                "created_by": {
                  "type": "string"
                },
                "updated_at": {
                  "type": "string"
                },
                "triggered_by": {
                  "type": "string"
                },
                "triggered_id": {
                  "type": "string"
                },
                "report_type": {
                  "type": "object",
                  "properties": {
                    "core_report_types": {
                      "type": "object",
                      "properties": {
                        "id": {
                          "type": "integer"
                        },
                        "code": {
                          "type": "string"
                        },
                        "label": {
                          "type": "string"
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }

         ```
      operationId: GetWorth360ReportDetails
      parameters:
        - name: reportID
          in: path
          description: ''
          required: true
          style: simple
          schema:
            type: string
            examples:
              - '{{report_id}}'
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
                  example: Fri, 11 Apr 2025 09:37:07 GMT
            Content-Length:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: '497'
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
                  example: W/"1f1-T/fSZL+xMQ8ipydSXu8Voo4Of9w"
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
                      #/components/schemas/REQUESTEDWorth360ReportDetailsFetchedSuccessfully
                  - examples:
                      - status: success
                        message: Report details fetched successfully
                        data:
                          id: 06cf2b4b-51fc-4e7f-8f60-e2c2ab161f23
                          report_type_id: 1
                          status: REQUESTED
                          log: null
                          created_at: '2025-04-10T10:41:50.398Z'
                          created_by: fe879c59-f9e4-4796-9a63-38927541f0d7
                          updated_at: '2025-04-10T10:41:50.398Z'
                          triggered_by: CUSTOMER
                          triggered_id: 815f078a-2bc7-4fa9-84cb-b4e0c62a504f
                          file_path: null
                          report_type:
                            core_report_types:
                              id: 1
                              code: business_report
                              label: Business Report
                contentMediaType: application/json; charset=utf-8
              example:
                status: success
                message: Report details fetched successfully
                data:
                  id: 06cf2b4b-51fc-4e7f-8f60-e2c2ab161f23
                  report_type_id: 1
                  status: REQUESTED
                  log: null
                  created_at: '2025-04-10T10:41:50.398Z'
                  created_by: fe879c59-f9e4-4796-9a63-38927541f0d7
                  updated_at: '2025-04-10T10:41:50.398Z'
                  triggered_by: CUSTOMER
                  triggered_id: 815f078a-2bc7-4fa9-84cb-b4e0c62a504f
                  file_path: null
                  report_type:
                    core_report_types:
                      id: 1
                      code: business_report
                      label: Business Report
      deprecated: false
      security:
        - bearer: []
components:
  schemas:
    REQUESTEDWorth360ReportDetailsFetchedSuccessfully:
      title: REQUESTEDWorth360ReportDetailsFetchedSuccessfully
      type: object
      properties:
        status:
          type: string
        message:
          type: string
        data:
          $ref: '#/components/schemas/Data6'
      examples:
        - status: success
          message: Report details fetched successfully
          data:
            id: 06cf2b4b-51fc-4e7f-8f60-e2c2ab161f23
            report_type_id: 1
            status: REQUESTED
            log: null
            created_at: '2025-04-10T10:41:50.398Z'
            created_by: fe879c59-f9e4-4796-9a63-38927541f0d7
            updated_at: '2025-04-10T10:41:50.398Z'
            triggered_by: CUSTOMER
            triggered_id: 815f078a-2bc7-4fa9-84cb-b4e0c62a504f
            file_path: null
            report_type:
              core_report_types:
                id: 1
                code: business_report
                label: Business Report
    Data6:
      title: Data6
      type: object
      properties:
        id:
          type: string
        report_type_id:
          type: integer
          contentEncoding: int32
        status:
          type: string
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
        file_path:
          type:
            - string
            - 'null'
        report_type:
          $ref: '#/components/schemas/ReportType'
      examples:
        - id: 06cf2b4b-51fc-4e7f-8f60-e2c2ab161f23
          report_type_id: 1
          status: REQUESTED
          log: null
          created_at: '2025-04-10T10:41:50.398Z'
          created_by: fe879c59-f9e4-4796-9a63-38927541f0d7
          updated_at: '2025-04-10T10:41:50.398Z'
          triggered_by: CUSTOMER
          triggered_id: 815f078a-2bc7-4fa9-84cb-b4e0c62a504f
          file_path: null
          report_type:
            core_report_types:
              id: 1
              code: business_report
              label: Business Report
    ReportType:
      title: ReportType
      type: object
      properties:
        core_report_types:
          $ref: '#/components/schemas/CoreReportTypes'
      examples:
        - core_report_types:
            id: 1
            code: business_report
            label: Business Report
    CoreReportTypes:
      title: CoreReportTypes
      type: object
      properties:
        id:
          type: integer
          contentEncoding: int32
        code:
          type: string
        label:
          type: string
      examples:
        - id: 1
          code: business_report
          label: Business Report
  securitySchemes:
    bearer:
      type: http
      scheme: bearer

````

Built with [Mintlify](https://mintlify.com).