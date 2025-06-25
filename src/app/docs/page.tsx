import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Code, ExternalLink, Zap, Database, CreditCard, Bot, Workflow, FileText } from "lucide-react"

export default function DocsPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">AIaaS Boilerplate Documentation</h1>
        <p className="text-xl text-muted-foreground mb-6">
          Complete guide to using the AIaaS Boilerplate platform
        </p>
        <div className="flex justify-center gap-2 flex-wrap">
          <Badge variant="secondary">Next.js 15</Badge>
          <Badge variant="secondary">TypeScript</Badge>
          <Badge variant="secondary">Stripe</Badge>
          <Badge variant="secondary">Supabase</Badge>
          <Badge variant="secondary">Clerk Auth</Badge>
          <Badge variant="secondary">Docker</Badge>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="api">API</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="auth">Auth</TabsTrigger>
          <TabsTrigger value="deployment">Deploy</TabsTrigger>
          <TabsTrigger value="examples">Examples</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Project Overview
              </CardTitle>
              <CardDescription>
                AIaaS Boilerplate is a modern platform built with Next.js 15 and TypeScript
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-semibold">Frontend</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Next.js 15 with App Router</li>
                    <li>• TypeScript for type safety</li>
                    <li>• Tailwind CSS for styling</li>
                    <li>• shadcn/ui components</li>
                    <li>• Responsive design</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold">Backend</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• API Routes in Next.js</li>
                    <li>• Supabase Database</li>
                    <li>• Clerk Authentication</li>
                    <li>• Stripe Payments</li>
                    <li>• Docker Support</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Start</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-muted p-4 rounded-lg">
                  <code className="text-sm">
                    {`# Clone and install
git clone https://github.com/Vesias/AIaaS-Boilerplate-Framework.git
cd AIaaS-Boilerplate-Framework
pnpm install

# Start development server
pnpm dev &

# Access the application
http://localhost:3000`}
                  </code>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* API Tab */}
        <TabsContent value="api" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5" />
                API Endpoints
              </CardTitle>
              <CardDescription>
                Available API routes and their usage
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h4 className="font-semibold mb-3">Authentication</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">POST</Badge>
                      <code>/api/webhooks/clerk</code>
                      <span className="text-muted-foreground">- Clerk webhook handler</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-3">Payments</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">POST</Badge>
                      <code>/api/checkout</code>
                      <span className="text-muted-foreground">- Create Stripe checkout session</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">POST</Badge>
                      <code>/api/customer-portal</code>
                      <span className="text-muted-foreground">- Access Stripe customer portal</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">GET</Badge>
                      <code>/api/subscription</code>
                      <span className="text-muted-foreground">- Get subscription status</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">POST</Badge>
                      <code>/api/webhooks/stripe</code>
                      <span className="text-muted-foreground">- Stripe webhook handler</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-3">Automation & AI</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">POST</Badge>
                      <code>/api/copilotkit</code>
                      <span className="text-muted-foreground">- CopilotKit integration</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">POST</Badge>
                      <code>/api/make/webhook</code>
                      <span className="text-muted-foreground">- Make.com webhook</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">POST</Badge>
                      <code>/api/n8n/webhook</code>
                      <span className="text-muted-foreground">- n8n workflow webhook</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">GET</Badge>
                      <code>/api/tasks</code>
                      <span className="text-muted-foreground">- Get user tasks</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">GET</Badge>
                      <code>/api/workflows</code>
                      <span className="text-muted-foreground">- Get user workflows</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-3">Utilities</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">GET</Badge>
                      <code>/api/health</code>
                      <span className="text-muted-foreground">- Health check endpoint</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">POST</Badge>
                      <code>/api/waitlist</code>
                      <span className="text-muted-foreground">- Waitlist signup</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Stripe Integration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">Payment processing and subscription management</p>
                <div className="space-y-2 text-sm">
                  <div>• Subscription billing</div>
                  <div>• One-time payments</div>
                  <div>• Customer portal</div>
                  <div>• Webhook handling</div>
                  <div>• European VAT compliance</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Supabase Database
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">PostgreSQL database with real-time features</p>
                <div className="space-y-2 text-sm">
                  <div>• User management</div>
                  <div>• Subscription tracking</div>
                  <div>• Task storage</div>
                  <div>• Workflow data</div>
                  <div>• Real-time updates</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  AI Integrations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">AI-powered features and chatbots</p>
                <div className="space-y-2 text-sm">
                  <div>• CopilotKit chat</div>
                  <div>• Agent-based automation</div>
                  <div>• AI task processing</div>
                  <div>• Smart workflows</div>
                  <div>• MCP protocol support</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Workflow className="h-5 w-5" />
                  Automation Tools
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">Workflow automation platforms</p>
                <div className="space-y-2 text-sm">
                  <div>• Make.com integration</div>
                  <div>• n8n workflows</div>
                  <div>• Webhook triggers</div>
                  <div>• Custom automations</div>
                  <div>• Event processing</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Auth Tab */}
        <TabsContent value="auth" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Authentication with Clerk</CardTitle>
              <CardDescription>User authentication and session management</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Features</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Email/password authentication</li>
                  <li>• Social login (Google, GitHub, etc.)</li>
                  <li>• Multi-factor authentication</li>
                  <li>• User profile management</li>
                  <li>• Organization support</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-semibold mb-2">Protected Routes</h4>
                <div className="bg-muted p-4 rounded-lg text-sm">
                  <code>
                    {`// middleware.ts
export default authMiddleware({
  publicRoutes: ["/", "/pricing", "/docs"],
  ignoredRoutes: ["/api/webhooks/(.*)"]
});`}
                  </code>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Usage in Components</h4>
                <div className="bg-muted p-4 rounded-lg text-sm">
                  <code>
                    {`import { useUser } from "@clerk/nextjs";

export function UserProfile() {
  const { user } = useUser();
  return <div>{user?.firstName}</div>
}`}
                  </code>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Deployment Tab */}
        <TabsContent value="deployment" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Deployment Options</CardTitle>
              <CardDescription>Multiple ways to deploy your application</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-semibold mb-3">Docker Deployment</h4>
                <div className="bg-muted p-4 rounded-lg text-sm">
                  <code>
                    {`# Build and run with Docker
docker-compose up --build

# Development mode
docker-compose -f docker-compose.dev.yml up`}
                  </code>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-3">Vercel Deployment</h4>
                <div className="bg-muted p-4 rounded-lg text-sm">
                  <code>
                    {`# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod`}
                  </code>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-3">Environment Variables</h4>
                <div className="space-y-2 text-sm">
                  <div>• <code>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code></div>
                  <div>• <code>CLERK_SECRET_KEY</code></div>
                  <div>• <code>NEXT_PUBLIC_SUPABASE_URL</code></div>
                  <div>• <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code></div>
                  <div>• <code>SUPABASE_SERVICE_ROLE_KEY</code></div>
                  <div>• <code>STRIPE_SECRET_KEY</code></div>
                  <div>• <code>STRIPE_WEBHOOK_SECRET</code></div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Examples Tab */}
        <TabsContent value="examples" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Code Examples
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-semibold mb-3">Creating a Subscription</h4>
                <div className="bg-muted p-4 rounded-lg text-sm">
                  <code>
                    {`const handleSubscribe = async () => {
  const response = await fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ priceId: 'price_123' })
  });
  const { url } = await response.json();
  window.location.href = url;
};`}
                  </code>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-3">Using Supabase Client</h4>
                <div className="bg-muted p-4 rounded-lg text-sm">
                  <code>
                    {`import { createClient } from '@/lib/supabase/client';

const supabase = createClient();
const { data, error } = await supabase
  .from('tasks')
  .select('*')
  .eq('user_id', userId);`}
                  </code>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-3">CopilotKit Integration</h4>
                <div className="bg-muted p-4 rounded-lg text-sm">
                  <code>
                    {`import { CopilotKit } from '@copilotkit/react-core';

<CopilotKit runtimeUrl="/api/copilotkit">
  <YourComponent />
</CopilotKit>`}
                  </code>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Useful Links</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <a href="https://nextjs.org/docs" className="flex items-center gap-2 text-sm hover:underline">
                    <ExternalLink className="h-4 w-4" />
                    Next.js Documentation
                  </a>
                  <a href="https://clerk.com/docs" className="flex items-center gap-2 text-sm hover:underline">
                    <ExternalLink className="h-4 w-4" />
                    Clerk Documentation
                  </a>
                  <a href="https://supabase.com/docs" className="flex items-center gap-2 text-sm hover:underline">
                    <ExternalLink className="h-4 w-4" />
                    Supabase Documentation
                  </a>
                </div>
                <div className="space-y-2">
                  <a href="https://stripe.com/docs" className="flex items-center gap-2 text-sm hover:underline">
                    <ExternalLink className="h-4 w-4" />
                    Stripe Documentation
                  </a>
                  <a href="https://ui.shadcn.com" className="flex items-center gap-2 text-sm hover:underline">
                    <ExternalLink className="h-4 w-4" />
                    shadcn/ui Components
                  </a>
                  <a href="https://tailwindcss.com/docs" className="flex items-center gap-2 text-sm hover:underline">
                    <ExternalLink className="h-4 w-4" />
                    Tailwind CSS
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
