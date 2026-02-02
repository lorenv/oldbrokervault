# AI CRM Assistant - Implementation Plan

## Overview
An always-on AI assistant integrated into the CRM that helps users understand their pipeline, find information, and (eventually) take actions on their behalf.

## Token Budget
- **Monthly cap**: 1,000,000 tokens per organization
- **Estimated cost**: ~$5-10/month at GPT-4o-mini rates
- **User pays**: $49/month minimum, so healthy margin

---

## Phase 1: Read-Only Assistant (Current)

### Capabilities
- Answer questions about deals, contacts, companies
- Summarize pipeline status
- Find specific records ("Who is the contact at Acme Corp?")
- Explain deal history and activity
- Provide insights ("Which deals are at risk?", "What's my pipeline value?")

### Technical Components
1. **Database**: Token usage tracking table
2. **Backend**:
   - OpenAI integration service
   - Chat API endpoint
   - Context retrieval (fetch relevant CRM data)
   - Token counting and rate limiting
3. **Frontend**:
   - Floating chat widget (bottom-right)
   - Message history
   - Typing indicators
   - Token usage display (optional)

### Data Context Strategy
- Fetch user's recent/relevant deals, contacts, companies
- Include pipeline stages and values
- Include recent activities
- Smart truncation to stay within context limits

---

## Phase 2: Action Suggestions

### Capabilities
- Suggest next steps for deals
- Recommend follow-up actions
- Draft email content
- Suggest task creation (but user confirms)

### Technical Components
- Action suggestion formatting
- Confirmation UI patterns
- Draft/preview states

---

## Phase 3: Direct Actions

### Capabilities
- Create tasks via chat
- Update deal stages
- Add notes to records
- Schedule follow-ups
- Create new contacts/deals

### Technical Components
- OpenAI function calling
- Action confirmation dialogs
- Undo/rollback capability
- Audit logging for AI actions

---

## Phase 4: Proactive Insights

### Capabilities
- Daily briefing generation
- Risk alerts ("Deal X hasn't been touched in 2 weeks")
- Opportunity suggestions
- Performance insights

### Technical Components
- Scheduled analysis jobs
- Notification integration
- Insight caching

---

## Security Considerations
- Assistant only sees data user has permission to access
- All queries scoped to user's organization
- Token limits prevent abuse
- No sensitive data (passwords, API keys) exposed to model

---

## Model Selection
- **Primary**: GPT-4o-mini (cost-effective, fast)
- **Fallback**: Can upgrade to GPT-4o for complex queries if needed
- **Future**: Consider Claude for longer context windows

---

## Metrics to Track
- Token usage per org/user
- Query success rate
- Response latency
- User satisfaction (thumbs up/down on responses)
