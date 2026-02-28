# Decision Export Formats

## Overview

Decision logs can be exported in multiple formats for different use cases: documentation, compliance, integration, presentation, and archival. Each format supports customization through templates and options.

## Supported Export Formats

### 1. JSON (Machine-Readable)

**Use case:** API integration, data processing, archival

```json
{
  "id": "log-123",
  "decisionContextId": "ctx-456",
  "title": "Approve roof repair budget",
  "meetingId": "meeting-789",
  "meetingTitle": "Housing Coop Committee - Feb 2026",
  "meetingDate": "2026-02-27",
  "template": {
    "id": "template-001",
    "name": "Standard Decision",
    "version": 1
  },
  "fields": {
    "decision_statement": "Approve £45,000 budget for full roof replacement",
    "decision_context": "Building requires urgent maintenance...",
    "options": [
      "Full replacement (£45,000)",
      "Partial repair (£25,000)",
      "Defer decision (£0)"
    ],
    "stakeholders": ["Residents", "Board", "Contractor"],
    "risks": ["Budget overrun", "Weather delays"],
    "timeline": "Start: March 2026, Complete: May 2026"
  },
  "decisionMethod": {
    "type": "consensus",
    "details": "Unanimous board approval after resident consultation"
  },
  "actors": ["Board Chair", "Treasurer", "Maintenance Committee"],
  "loggedBy": "Alice",
  "loggedAt": "2026-02-27T16:30:00Z",
  "expertAdvice": [
    {
      "expertType": "policy-compliance",
      "advice": "Aligns with capital expenditure policy...",
      "concerns": ["Requires board approval"],
      "recommendations": ["Document vendor selection process"]
    }
  ],
  "sourceTranscript": {
    "chunkIds": ["chunk-1", "chunk-2", "chunk-3"],
    "totalTokens": 2500,
    "coverage": "45 seconds"
  }
}
```

### 2. Markdown (Human-Readable Documentation)

**Use case:** Documentation, wikis, reports

```markdown
# Approve roof repair budget

**Meeting:** Housing Coop Committee - Feb 2026  
**Date:** 2026-02-27  
**Decision ID:** log-123  
**Logged by:** Alice on 2026-02-27 at 16:30

---

## Decision Statement

Approve £45,000 budget for full roof replacement

## Context

Building requires urgent maintenance due to multiple leaks identified during winter inspection. Contractor assessment indicates full replacement is more cost-effective than ongoing repairs.

## Options Considered

1. **Full replacement** - £45,000
   - Complete roof overhaul
   - 20-year warranty
   - Recommended by contractor

2. **Partial repair** - £25,000
   - Patch existing damage
   - 5-year expected lifespan
   - May require additional work

3. **Defer decision** - £0
   - Risk of further damage
   - Emergency repairs likely needed

## Stakeholders

- **Residents** - Affected by disruption, benefit from improved building
- **Board** - Financial oversight and approval authority
- **Contractor** - Execution and warranty provider

## Risks

- **Budget overrun** - Weather or structural issues may increase costs
- **Weather delays** - Winter work may extend timeline
- **Resident disruption** - Noise and access restrictions during work

## Timeline

- **Start:** March 2026
- **Complete:** May 2026
- **Duration:** ~8 weeks

## Decision Method

**Type:** Consensus  
**Details:** Unanimous board approval after resident consultation

**Actors:** Board Chair, Treasurer, Maintenance Committee

---

## Expert Advice

### Policy Compliance Expert

**Advice:** This decision aligns with the capital expenditure policy section 3.2 regarding major building maintenance.

**Concerns:**
- Requires formal board approval (quorum met)
- Must document vendor selection process

**Recommendations:**
- Obtain at least 3 competitive quotes
- Document selection criteria
- Schedule resident information session

---

**Logged:** 2026-02-27T16:30:00Z by Alice
```

### 3. HTML (Web Display)

**Use case:** Web portals, dashboards, email

```html
<!DOCTYPE html>
<html>
<head>
  <title>Decision: Approve roof repair budget</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; }
    .header { background: #f5f5f5; padding: 20px; border-left: 4px solid #2196F3; }
    .section { margin: 30px 0; }
    .field-label { font-weight: bold; color: #555; }
    .stakeholder { display: inline-block; padding: 5px 10px; background: #e3f2fd; margin: 5px; border-radius: 3px; }
    .risk { color: #d32f2f; }
    .expert-advice { background: #fff3e0; padding: 15px; border-left: 4px solid #ff9800; margin: 10px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Approve roof repair budget</h1>
    <p><strong>Meeting:</strong> Housing Coop Committee - Feb 2026</p>
    <p><strong>Date:</strong> 2026-02-27</p>
    <p><strong>Logged by:</strong> Alice on 2026-02-27 at 16:30</p>
  </div>

  <div class="section">
    <h2>Decision Statement</h2>
    <p>Approve £45,000 budget for full roof replacement</p>
  </div>

  <div class="section">
    <h2>Context</h2>
    <p>Building requires urgent maintenance due to multiple leaks...</p>
  </div>

  <div class="section">
    <h2>Stakeholders</h2>
    <span class="stakeholder">Residents</span>
    <span class="stakeholder">Board</span>
    <span class="stakeholder">Contractor</span>
  </div>

  <div class="section">
    <h2>Expert Advice</h2>
    <div class="expert-advice">
      <h3>Policy Compliance Expert</h3>
      <p>This decision aligns with the capital expenditure policy...</p>
    </div>
  </div>
</body>
</html>
```

### 4. PDF (Formal Documentation)

**Use case:** Official records, compliance, archival

- Professional formatting
- Page numbers and headers
- Table of contents
- Signatures section
- Watermarks (optional)
- Metadata embedded

### 5. CSV (Tabular Data)

**Use case:** Spreadsheet import, data analysis

```csv
Decision ID,Title,Meeting,Date,Decision Statement,Decision Method,Actors,Logged By,Logged At
log-123,"Approve roof repair budget","Housing Coop Committee","2026-02-27","Approve £45,000 budget for full roof replacement","consensus","Board Chair; Treasurer; Maintenance Committee","Alice","2026-02-27T16:30:00Z"
```

### 6. DOCX (Microsoft Word)

**Use case:** Editing, collaboration, templates

- Editable format
- Template-based styling
- Comments and track changes support
- Mail merge compatible

### 7. Plain Text (Simple)

**Use case:** Email, terminal, simple systems

```
DECISION LOG
============

Title: Approve roof repair budget
Meeting: Housing Coop Committee - Feb 2026
Date: 2026-02-27
Decision ID: log-123

DECISION STATEMENT
------------------
Approve £45,000 budget for full roof replacement

CONTEXT
-------
Building requires urgent maintenance due to multiple leaks...

OPTIONS CONSIDERED
------------------
1. Full replacement - £45,000
2. Partial repair - £25,000
3. Defer decision - £0

STAKEHOLDERS
------------
- Residents
- Board
- Contractor

DECISION METHOD
---------------
Type: Consensus
Details: Unanimous board approval after resident consultation
Actors: Board Chair, Treasurer, Maintenance Committee

Logged by Alice on 2026-02-27 at 16:30
```

## Export API

### Basic Export

```http
GET /api/decision-logs/{logId}/export?format=markdown

Response:
Content-Type: text/markdown
Content-Disposition: attachment; filename="decision-log-123.md"

# Approve roof repair budget
...
```

### Advanced Export with Options

```http
POST /api/decision-logs/{logId}/export
{
  "format": "markdown",
  "options": {
    "includeExpertAdvice": true,
    "includeTranscriptReferences": false,
    "includeMetadata": true,
    "template": "formal",
    "sections": ["statement", "context", "options", "stakeholders", "risks", "timeline", "method"],
    "customFields": {
      "organizationName": "Housing Cooperative Ltd",
      "documentNumber": "DEC-2026-001"
    }
  }
}
```

### Batch Export

```http
POST /api/decision-logs/export/batch
{
  "logIds": ["log-123", "log-456", "log-789"],
  "format": "pdf",
  "options": {
    "combineIntoSingle": true,
    "includeTableOfContents": true,
    "template": "formal"
  }
}

Response:
Content-Type: application/pdf
Content-Disposition: attachment; filename="decisions-2026-02.pdf"
```

## Export Templates

### Template Types

**1. Minimal**
- Decision statement
- Date and actors
- Basic metadata

**2. Standard** (Default)
- All decision fields
- Decision method
- Logged by/at

**3. Formal**
- Full details
- Expert advice
- Signatures section
- Official formatting

**4. Executive Summary**
- High-level overview
- Key points only
- Condensed format

**5. Compliance**
- All fields required for audit
- Expert advice mandatory
- Transcript references
- Approval chain

**6. Custom**
- User-defined template
- Field selection
- Custom formatting

### Template Configuration

```typescript
{
  "templateId": "formal",
  "sections": [
    {
      "id": "header",
      "title": "Decision Record",
      "fields": ["title", "meeting", "date", "id"]
    },
    {
      "id": "decision",
      "title": "Decision Details",
      "fields": ["statement", "context", "method"]
    },
    {
      "id": "analysis",
      "title": "Analysis",
      "fields": ["options", "stakeholders", "risks", "timeline"]
    },
    {
      "id": "approval",
      "title": "Approval",
      "fields": ["actors", "loggedBy", "loggedAt"]
    },
    {
      "id": "expert",
      "title": "Expert Consultation",
      "fields": ["expertAdvice"]
    },
    {
      "id": "signatures",
      "title": "Signatures",
      "custom": true
    }
  ],
  "formatting": {
    "pageSize": "A4",
    "margins": "normal",
    "font": "Arial",
    "fontSize": 11,
    "includePageNumbers": true,
    "includeWatermark": false
  }
}
```

## Export Options

### Common Options

```typescript
{
  // Content selection
  "includeExpertAdvice": boolean,
  "includeTranscriptReferences": boolean,
  "includeMetadata": boolean,
  "includeMeetingContext": boolean,
  
  // Field filtering
  "sections": string[],  // Which sections to include
  "excludeFields": string[],  // Fields to omit
  
  // Formatting
  "template": "minimal" | "standard" | "formal" | "executive" | "compliance" | "custom",
  "dateFormat": "ISO" | "US" | "UK" | "custom",
  "timezone": string,
  
  // Customization
  "customFields": Record<string, any>,
  "headerText": string,
  "footerText": string,
  "watermark": string,
  
  // Output
  "filename": string,
  "inline": boolean  // Display in browser vs download
}
```

### Format-Specific Options

**PDF Options:**
```typescript
{
  "pageSize": "A4" | "Letter" | "Legal",
  "orientation": "portrait" | "landscape",
  "margins": "narrow" | "normal" | "wide",
  "includePageNumbers": boolean,
  "includeTableOfContents": boolean,
  "signatureFields": boolean
}
```

**HTML Options:**
```typescript
{
  "standalone": boolean,  // Include <html> wrapper
  "inlineCSS": boolean,   // Embed styles vs external
  "theme": "light" | "dark" | "print",
  "responsive": boolean
}
```

**Markdown Options:**
```typescript
{
  "flavor": "github" | "commonmark" | "extended",
  "includeYAMLFrontmatter": boolean,
  "headingLevel": 1 | 2 | 3  // Starting heading level
}
```

## CLI Export Commands

```bash
# Basic export
decision-logger decision export log-123 --format markdown

# With options
decision-logger decision export log-123 \
  --format pdf \
  --template formal \
  --output decision-2026-001.pdf

# Batch export
decision-logger decisions export \
  --meeting meeting-789 \
  --format pdf \
  --combine \
  --output meeting-decisions.pdf

# Custom template
decision-logger decision export log-123 \
  --format markdown \
  --template custom \
  --config export-template.json
```

## Example Use Cases

### 1. Board Meeting Minutes

```http
POST /api/decision-logs/export/batch
{
  "logIds": ["log-1", "log-2", "log-3"],
  "format": "pdf",
  "options": {
    "template": "formal",
    "combineIntoSingle": true,
    "includeTableOfContents": true,
    "customFields": {
      "meetingTitle": "Board Meeting - February 2026",
      "documentNumber": "MIN-2026-02"
    }
  }
}
```

### 2. Compliance Archive

```http
POST /api/decision-logs/{logId}/export
{
  "format": "pdf",
  "options": {
    "template": "compliance",
    "includeExpertAdvice": true,
    "includeTranscriptReferences": true,
    "includeMetadata": true,
    "watermark": "OFFICIAL RECORD"
  }
}
```

### 3. Email Summary

```http
GET /api/decision-logs/{logId}/export
  ?format=html
  &template=executive
  &inline=true

# Returns HTML suitable for email body
```

### 4. Data Export for Analysis

```http
POST /api/decision-logs/export/batch
{
  "meetingId": "meeting-789",
  "format": "csv",
  "options": {
    "includeAllFields": true,
    "flattenArrays": true
  }
}
```

## Implementation Notes

### Server-Side Rendering

```typescript
async function exportDecisionLog(logId, format, options) {
  // 1. Fetch decision log with all relations
  const log = await db.decisionLogs.findById(logId, {
    include: ['meeting', 'template', 'expertAdvice', 'decisionContext']
  });
  
  // 2. Load export template
  const template = await loadExportTemplate(options.template || 'standard');
  
  // 3. Render based on format
  switch (format) {
    case 'json':
      return renderJSON(log, options);
    case 'markdown':
      return renderMarkdown(log, template, options);
    case 'html':
      return renderHTML(log, template, options);
    case 'pdf':
      return renderPDF(log, template, options);
    case 'csv':
      return renderCSV(log, options);
    case 'docx':
      return renderDOCX(log, template, options);
    case 'txt':
      return renderText(log, options);
  }
}
```

### Template Engine

Use a template engine (e.g., Handlebars, EJS) for flexible formatting:

```handlebars
# {{title}}

**Meeting:** {{meeting.title}}  
**Date:** {{formatDate meeting.date}}  
**Decision ID:** {{id}}

---

## Decision Statement

{{fields.decision_statement}}

{{#if options.includeExpertAdvice}}
## Expert Advice

{{#each expertAdvice}}
### {{expertType}}

{{advice}}
{{/each}}
{{/if}}
```

## Benefits

✅ **Multiple formats** - Choose the right format for each use case  
✅ **Customizable** - Templates and options for different needs  
✅ **Batch export** - Export multiple decisions at once  
✅ **Professional output** - Formal formatting for compliance  
✅ **Integration-ready** - JSON/CSV for data processing  
✅ **Human-readable** - Markdown/HTML for documentation  
✅ **Archival** - PDF for long-term storage  

The export system provides flexibility while maintaining consistency across all decision documentation.
