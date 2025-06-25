# 🚀 Roomicor Quick Start Guide

## ⚡ Instant Setup (5 Minutes)

### 1. **Install Dependencies**
```bash
pnpm install
```

### 2. **Environment Setup**
```bash
cp .env.example .env.local
```

**Edit `.env.local` with your keys:**
```env
# Required for basic functionality
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key
CLERK_SECRET_KEY=sk_test_your_key
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
STRIPE_SECRET_KEY=sk_test_your_stripe_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_key
OPENAI_API_KEY=sk-your_openai_key
```

### 3. **Start Development**
```bash
pnpm dev
```

## 🎯 **Feature Validation**

### **Test Core Features**
1. **Authentication**: Visit `/sign-in` - Clerk auth working
2. **Dashboard**: Visit `/dashboard` - All 4 main sections accessible
3. **AI Assistant**: Visit `/dashboard/ai` - 4 AI protocols ready
4. **Tasks**: Visit `/dashboard/tasks` - Task management with AI
5. **Workflows**: Visit `/dashboard/workflows` - Automation ready
6. **Invoices**: Visit `/dashboard/invoices` - EU-compliant billing

### **API Endpoints Test**
```bash
# Health check
curl http://localhost:3000/api/health

# CopilotKit (requires auth)
curl http://localhost:3000/api/copilotkit

# Invoice generation
curl -X POST http://localhost:3000/api/invoices/numbering
```

## 🔧 **Configuration Quick Reference**

### **AI Models Available**
- **OpenAI**: GPT-4o, GPT-4o-mini, GPT-3.5-turbo
- **Anthropic**: Claude-3.5-sonnet, Claude-3-haiku
- **Google**: Gemini-pro, Gemini-pro-vision
- **Local**: Ollama support ready

### **Payment Features**
- **Subscriptions**: Monthly/yearly with Stripe
- **Invoices**: EU VAT compliant, multi-currency
- **Payment Methods**: Cards, SEPA, bank transfers
- **Tax Calculation**: Real-time EU rates

### **Automation Ready**
- **n8n**: Visual workflow builder
- **Make.com**: Advanced scenarios
- **Custom APIs**: RESTful webhook system
- **Scheduling**: Cron-based automation

## 🚀 **Production Deployment**

### **Docker (Recommended)**
```bash
# Build and run
docker-compose up --build
```

### **Vercel (Fastest)**
```bash
# Connect to Vercel
npx vercel --prod
```

### **Kubernetes (Enterprise)**
```bash
# Apply configurations
kubectl apply -f k8s/
```

## 📊 **Monitoring Dashboard**

### **Health Endpoints**
- `/api/health` - Application health
- `/api/health/detailed` - Full system status
- `/metrics` - Prometheus metrics

### **Admin Features**
- User management via Clerk Dashboard
- Payment analytics via Stripe Dashboard
- Workflow monitoring via n8n interface
- Database management via Supabase

## 🎯 **Success Metrics**

After setup, you should have:
- ✅ Authentication working (Clerk)
- ✅ Database connected (Supabase)
- ✅ Payments ready (Stripe)
- ✅ AI features active (4 protocols)
- ✅ Workflows operational (n8n/Make.com)
- ✅ Invoices EU-compliant

## 🆘 **Troubleshooting**

### **Common Issues**
1. **Port 3000 in use**: App will auto-use 3001
2. **Environment missing**: Check all required vars in `.env.local`
3. **Auth not working**: Verify Clerk keys and URLs
4. **Payments failing**: Check Stripe webhook endpoints
5. **AI not responding**: Verify OpenAI API key and quota

### **Debug Commands**
```bash
# Check build
pnpm build

# Type checking
pnpm type-check

# Dependency audit
pnpm audit

# Health check
curl http://localhost:3000/api/health
```

## 🎉 **You're Ready!**

Your **Enterprise AIaaS Platform** is now fully operational with:
- 4 AI protocols integrated
- European business compliance
- Workflow automation
- Professional invoicing
- Production-ready infrastructure

**Start building the future of AI automation!** 🚀