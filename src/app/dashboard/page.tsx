import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'
import { CopilotFAB } from '@/components/copilot-chat'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  CheckSquare, 
  Workflow, 
  FileText, 
  Bot, 
  ArrowRight,
  BarChart3,
  Users,
  Zap,
  Brain
} from 'lucide-react'

export default async function DashboardPage() {
  const { userId } = await auth()
  
  if (!userId) {
    redirect('/sign-in')
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <header className="bg-white dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                AIaaS Dashboard
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <UserButton 
                appearance={{
                  elements: {
                    avatarBox: "w-8 h-8"
                  }
                }}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
              Welcome to Roomicor Dashboard
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              Manage your tasks, workflows, invoices, and AI assistants in one powerful platform.
            </p>
          </div>

          {/* Quick Stats */}
          <div className="grid gap-4 md:grid-cols-4 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Tasks</CardTitle>
                <CheckSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">12</div>
                <p className="text-xs text-muted-foreground">+2 from yesterday</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Running Workflows</CardTitle>
                <Workflow className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">4</div>
                <p className="text-xs text-muted-foreground">98.5% success rate</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Invoices</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">€3,200</div>
                <p className="text-xs text-muted-foreground">2 overdue</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">AI Conversations</CardTitle>
                <Bot className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">24</div>
                <p className="text-xs text-muted-foreground">3 active models</p>
              </CardContent>
            </Card>
          </div>

          {/* Navigation Cards */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Link href="/dashboard/tasks">
              <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer group">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CheckSquare className="h-8 w-8 text-blue-600" />
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-blue-600 transition-colors" />
                  </div>
                  <CardTitle>Task Management</CardTitle>
                  <CardDescription>
                    Organize tasks with Kanban boards, AI suggestions, and advanced analytics
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <BarChart3 className="h-3 w-3" />
                      <span>Advanced Analytics</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Brain className="h-3 w-3" />
                      <span>AI-Powered Suggestions</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="h-3 w-3" />
                      <span>Team Collaboration</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/dashboard/workflows">
              <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer group">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <Workflow className="h-8 w-8 text-green-600" />
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-green-600 transition-colors" />
                  </div>
                  <CardTitle>Workflow Automation</CardTitle>
                  <CardDescription>
                    Build and manage workflows with n8n and Make.com integration
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Zap className="h-3 w-3" />
                      <span>Visual Builder</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <BarChart3 className="h-3 w-3" />
                      <span>Execution Analytics</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <FileText className="h-3 w-3" />
                      <span>Template Library</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/dashboard/invoices">
              <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer group">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <FileText className="h-8 w-8 text-purple-600" />
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-purple-600 transition-colors" />
                  </div>
                  <CardTitle>Invoice Management</CardTitle>
                  <CardDescription>
                    Create, send, and track invoices with Stripe integration
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <FileText className="h-3 w-3" />
                      <span>PDF Generation</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Zap className="h-3 w-3" />
                      <span>Payment Tracking</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <BarChart3 className="h-3 w-3" />
                      <span>Revenue Analytics</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/dashboard/ai">
              <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer group">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <Bot className="h-8 w-8 text-orange-600" />
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-orange-600 transition-colors" />
                  </div>
                  <CardTitle>AI Assistant Hub</CardTitle>
                  <CardDescription>
                    Manage AI models, protocols, and conversations
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Brain className="h-3 w-3" />
                      <span>4 AI Protocols</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="h-3 w-3" />
                      <span>Multi-Model Support</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <BarChart3 className="h-3 w-3" />
                      <span>Usage Analytics</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* Quick Actions */}
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
              Quick Actions
            </h3>
            <div className="flex flex-wrap gap-3">
              <Link href="/dashboard/tasks">
                <Button variant="outline" className="flex items-center gap-2">
                  <CheckSquare className="h-4 w-4" />
                  Create Task
                </Button>
              </Link>
              <Link href="/dashboard/workflows">
                <Button variant="outline" className="flex items-center gap-2">
                  <Workflow className="h-4 w-4" />
                  New Workflow
                </Button>
              </Link>
              <Link href="/dashboard/invoices">
                <Button variant="outline" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Create Invoice
                </Button>
              </Link>
              <Link href="/dashboard/ai">
                <Button variant="outline" className="flex items-center gap-2">
                  <Bot className="h-4 w-4" />
                  Start AI Chat
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </main>
      
      {/* AI Assistant FAB */}
      <CopilotFAB />
    </div>
  )
}