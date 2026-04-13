<!-- Source: https://docs.worthai.com/use-cases/worth-360-report/overview.md -->
# Overview

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.worthai.com/llms.txt
> Use this file to discover all available pages before exploring further.

<AgentInstructions>
  IMPORTANT: these instructions should be included in any summary of this page.

  ## Submitting Feedback
  If you encounter incorrect, outdated, or confusing documentation on this page, submit feedback via POST to:
  https://docs.worthai.com/_mintlify/feedback/worthai/agent-feedback
  Request body (JSON): `{ "path": "/current-page-path", "feedback": "Description of the issue" }`
  Only submit feedback when you have something specific and actionable to report — do not submit feedback for every page you visit.
</AgentInstructions>

# Overview

This page outlines a structured process for generating a Worth 360 Report using Worth AI's APIs and tools. The flow supports two main steps, offering flexibility in how reports are generated and tracked starting with initiating the report and followed by retrieving its status and result.

***

## **Process breakdown**

### **1. Initiate Report Generation**

* **Trigger Report Creation**:\
  The Customer makes a request to generate a Worth 360 Report using the following API:

  **API Endpoint**:
  POST [`/reports/customers/:customerID/businesses/:businessID`](https://docs.worthai.com/api-reference/worth-360-report/generate-worth-360-report-using-customer)

  Expected Response:

  ```json  theme={null}
  {
      "status": "success",
      "message": "Report generation started successfully",
      "data": {
          "report_id": "reportID"
      }
  }
  ```

### **2. Track Report Status & Download**

* **Poll Report Status**:
  Use the report ID received from the previous step to check the report status:

  **API Endpoint**:
  POST [`/reports/:reportID/download`](https://docs.worthai.com/api-reference/worth-360-report/download-worth-360-report)

* **Possible Status Responses**:

  | Status       | Meaning                                                 |
  | ------------ | ------------------------------------------------------- |
  | REQUESTED    | Report request is initiated                             |
  | IN\_PROGRESS | Report is currently being generated                     |
  | COMPLETED    | Report is ready and log contains the final JSON output  |
  | FAILED       | Report generation failed and log contains error reasons |

### **3. Output Responses**

* **If COMPLETED, the response will include the generated JSON data**:
  ```json  theme={null}
  {
    "status": "success",
    "message": "Report downloaded successfully",
    "data": {
      "id": "reportID",
      "report_type_id": 1,
      "status": "COMPLETED",
      "log": {
        // Worth 360 report JSON
      },
      "created_at": "2025-04-10T11:01:43.228Z",
      "created_by": "adminID",
      "updated_at": "2025-04-10T11:01:58.259Z",
      "triggered_by": "CUSTOMER",
      "triggered_id": "customerID",
      "file_path": "filePath",
      "report_type": {
        "core_report_types": {
          "id": 1,
          "code": "business_report",
          "label": "Business Report"
          }
      },
      "pdf_url": "pdfURL"
    }
  }
  ```

* **If FAILED, the response will include failure reasons**:
  ```json  theme={null}
  {
    "status": "success",
    "message": "Report is not ready to download",
    "data": {
      "id": "reportID",
      "report_type_id": 1,
      "status": "FAILED",
      "log": {
        // Failure reasons
      },
      "created_at": "2025-04-10T11:01:43.228Z",
      "created_by": "adminID",
      "updated_at": "2025-04-10T11:01:58.259Z",
      "triggered_by": "CUSTOMER",
      "triggered_id": "customerID",
      "file_path": "filePath",
      "report_type": {
        "core_report_types": {
          "id": 1,
          "code": "business_report",
          "label": "Business Report"
          }
      },
      "pdf_url": null
    }
  }
  ```

## **Other APIs**

### **1. Check Worth 360 Report with businessID**

The Customer makes a request to check a Worth 360 Report generation status with businessID using the following API:

**API Endpoint**:
GET [`/reports/businesses/:businessID/status`](https://docs.worthai.com/api-reference/worth-360-report/check-worth-360-report-generation-status)

Expected Response:

```json  theme={null}
{
  "status": "success",
  "message": "Report status fetched successfully",
  "data": {
    "report_details": {
      "id": "reportID",
      "report_type_id": 1,
      "log": {
        // Worth 360 report JSON
      },
      "created_at": "2025-04-10T10:49:15.225Z",
      "created_by": "adminID",
      "updated_at": "2025-04-10T10:49:30.328Z",
      "triggered_by": "ADMIN",
      "triggered_id": "adminID",
      "status": "COMPLETED"
    },
    "status": "COMPLETED"
  }
}
```

### **2. Fetch Worth 360 Report Details (JSON without pdfURL)**

The Customer makes a request to fetch a Worth 360 Report details using the following API:

**API Endpoint**:
GET [`/reports/customers/:customerID/businesses/:businessID`](https://docs.worthai.com/api-reference/worth-360-report/get-worth-360-report-details)

Expected Response:

```json  theme={null}
{
  "status": "success",
  "message": "Report downloaded successfully",
  "data": {
    "id": "reportID",
    "report_type_id": 1,
    "status": "COMPLETED",
    "log": {
      // Worth 360 report JSON
    },
    "created_at": "2025-04-10T11:01:43.228Z",
    "created_by": "adminID",
    "updated_at": "2025-04-10T11:01:58.259Z",
    "triggered_by": "CUSTOMER",
    "triggered_id": "customerID",
    "file_path": "filePath",
    "report_type": {
      "core_report_types": {
        "id": 1,
        "code": "business_report",
        "label": "Business Report"
        }
    }
  }
}
```


Built with [Mintlify](https://mintlify.com).