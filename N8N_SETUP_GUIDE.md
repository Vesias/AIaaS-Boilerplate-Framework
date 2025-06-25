# n8n Integration Setup Guide

## 1. n8n Instance Setup

### Self-hosted n8n (Recommended for development)

```bash
# Using Docker
docker run -d \
  --name n8n \
  -p 5678:5678 \
  -e N8N_BASIC_AUTH_ACTIVE=true \
  -e N8N_BASIC_AUTH_USER=admin \
  -e N8N_BASIC_AUTH_PASSWORD=password \
  -v ~/.n8n:/home/node/.n8n \
  n8nio/n8n

# Access n8n at http://localhost:5678
```

### n8n Cloud (Production)

1. Sign up at [n8n.cloud](https://n8n.cloud)
2. Create a new instance
3. Get your instance URL

## 2. Environment Variables Configuration

Update your `.env.local` with your n8n credentials:

```bash
# n8n Configuration
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/your-webhook-id
N8N_API_KEY=your_n8n_api_key
N8N_INSTANCE_URL=https://your-n8n-instance.com
N8N_WEBHOOK_AUTH=your_webhook_auth_token
```

### How to get these values:

1. **N8N_WEBHOOK_URL**: Create a workflow with a Webhook node, copy the URL
2. **N8N_API_KEY**: Go to n8n Settings > API Keys > Create new key
3. **N8N_INSTANCE_URL**: Your n8n instance base URL
4. **N8N_WEBHOOK_AUTH**: Optional, set in webhook node for security

## 3. Creating Workflows in n8n

### Example: User Signup Workflow

1. Create new workflow in n8n
2. Add **Webhook** node as trigger
3. Set webhook URL path (e.g., `/webhook/user-signup`)
4. Add authentication if needed
5. Add processing nodes (Email, Database, Slack, etc.)

### Example: Order Processing Workflow

```json
{
  "nodes": [
    {
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "parameters": {
        "path": "order-webhook",
        "httpMethod": "POST"
      }
    },
    {
      "name": "Send Email",
      "type": "n8n-nodes-base.emailSend",
      "parameters": {
        "to": "{{$json.email}}",
        "subject": "Order Confirmation",
        "text": "Your order #{{$json.orderId}} has been received!"
      }
    }
  ]
}
```

## 4. Webhook Configuration

### In n8n (Receiving webhooks from Next.js):
1. Add Webhook node to workflow
2. Set HTTP method to POST
3. Optional: Add authentication
4. Configure response format

### In Next.js (Receiving webhooks from n8n):
Your webhook endpoint is ready at: `/api/n8n/webhook`

Test it:
```bash
curl -X GET http://localhost:3000/api/n8n/webhook
```

## 5. Common Workflow Patterns

### Pattern 1: Event-Driven Automation
```
Next.js → n8n Webhook → Email/Slack/Database
```

### Pattern 2: Scheduled Tasks
```
n8n Cron → HTTP Request → Next.js API → Database Update
```

### Pattern 3: User Journey Automation
```
User Action → Next.js → n8n → Multi-step Workflow → Next.js Webhook
```

## 6. Available Server Actions

Use these in your Next.js components:

```typescript
import { 
  triggerUserSignupWorkflow,
  triggerOrderWorkflow,
  triggerPaymentSuccessWorkflow,
  triggerUserActivityWorkflow,
  sendNotificationWorkflow,
  triggerCustomWorkflow
} from '@/app/actions/n8n-workflows'

// Example usage
const result = await triggerUserSignupWorkflow(user.email)
```

## 7. Testing Workflows

### Using the n8n Workflow Trigger Component:

```tsx
import { N8nWorkflowTrigger } from '@/components/n8n-workflow-trigger'

export default function TestPage() {
  return <N8nWorkflowTrigger />
}
```

### Manual Testing:

```bash
# Test Next.js webhook endpoint
curl -X POST http://localhost:3000/api/n8n/webhook \
  -H "Content-Type: application/json" \
  -d '{"event": "test", "message": "Hello from n8n!"}'

# Test n8n webhook (replace URL)
curl -X POST https://your-n8n-instance.com/webhook/your-webhook-id \
  -H "Content-Type: application/json" \
  -d '{"event": "user.signup", "userId": "test", "email": "test@example.com"}'
```

## 8. Production Deployment

### Security Checklist:
- ✅ Set strong webhook authentication tokens
- ✅ Use HTTPS for all webhook URLs
- ✅ Validate webhook payloads
- ✅ Implement rate limiting
- ✅ Use environment variables for all credentials

### n8n Cloud Setup:
1. Update `N8N_INSTANCE_URL` to your cloud instance
2. Generate API key in n8n cloud settings
3. Update webhook URLs in your workflows
4. Test all integrations

### Self-hosted Production:
- Use reverse proxy (nginx/Cloudflare)
- Enable SSL certificates
- Set up monitoring and backups
- Configure proper authentication

## 9. Common Use Cases

### E-commerce:
- Order confirmation emails
- Inventory updates
- Payment processing notifications
- Customer support ticket creation

### SaaS:
- User onboarding sequences
- Feature usage tracking
- Subscription management
- Support escalations

### Marketing:
- Lead scoring
- Email campaigns
- Social media posting
- Analytics reporting

## 10. Troubleshooting

### Common Issues:

1. **Webhook not receiving data**
   - Check URL configuration
   - Verify authentication tokens
   - Check n8n workflow is active

2. **CORS errors**
   - Add proper headers in n8n response
   - Check domain whitelist

3. **Authentication failures**
   - Verify API keys
   - Check webhook auth tokens
   - Validate header format

### Debug Mode:
Enable detailed logging in your Next.js API routes and n8n workflows to track data flow.

## 11. Next Steps

1. **Set up your first workflow** in n8n
2. **Test the integration** using the trigger component
3. **Configure production webhooks** with proper authentication
4. **Monitor workflow executions** in n8n dashboard
5. **Scale your automation** by adding more complex workflows