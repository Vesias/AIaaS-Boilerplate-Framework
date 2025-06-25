'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { 
  Search, 
  Filter, 
  Star, 
  Download, 
  Play, 
  Eye, 
  Copy, 
  Clock, 
  Users, 
  TrendingUp,
  Mail,
  Database,
  Globe,
  Calendar,
  FileText,
  MessageSquare,
  Zap,
  GitBranch,
  Webhook,
  Shield,
  BarChart3,
  Settings,
  Smartphone,
  Cloud,
  Code,
  Plus,
  Grid3X3 as Grid,
  Calculator
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

export interface WorkflowTemplate {
  id: string
  name: string
  description: string
  category: 'productivity' | 'marketing' | 'sales' | 'support' | 'devops' | 'finance' | 'hr' | 'general'
  complexity: 'beginner' | 'intermediate' | 'advanced'
  estimatedSetupTime: number // minutes
  tags: string[]
  icon: any
  color: string
  preview: {
    nodeCount: number
    triggerType: string
    actionTypes: string[]
    sampleData?: any
  }
  template: {
    nodes: any[]
    edges: any[]
    settings: any
  }
  usage: {
    downloads: number
    rating: number
    reviews: number
  }
  author: {
    name: string
    avatar?: string
    verified: boolean
  }
  createdAt: string
  updatedAt: string
  version: string
  requirements: string[]
  documentation: string
  isOfficial: boolean
  isPremium: boolean
}

interface WorkflowTemplatesProps {
  templates: WorkflowTemplate[]
  onUseTemplate: (template: WorkflowTemplate) => void
  onPreviewTemplate: (template: WorkflowTemplate) => void
  className?: string
  showCategories?: boolean
  allowFiltering?: boolean
}

const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'email-automation',
    name: 'Email Marketing Automation',
    description: 'Automated email sequences based on user actions and triggers',
    category: 'marketing',
    complexity: 'intermediate',
    estimatedSetupTime: 15,
    tags: ['email', 'marketing', 'automation', 'drip-campaign'],
    icon: Mail,
    color: 'bg-blue-100 border-blue-300',
    preview: {
      nodeCount: 8,
      triggerType: 'webhook',
      actionTypes: ['email', 'delay', 'condition'],
      sampleData: {
        emailsPerMonth: 5000,
        openRate: '24%',
        clickRate: '3.2%'
      }
    },
    template: {
      nodes: [],
      edges: [],
      settings: {}
    },
    usage: {
      downloads: 1250,
      rating: 4.8,
      reviews: 89
    },
    author: {
      name: 'Marketing Team',
      verified: true
    },
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: '2024-01-20T00:00:00Z',
    version: '2.1.0',
    requirements: ['Email service integration', 'Contact database'],
    documentation: 'Complete guide for setting up email automation workflows...',
    isOfficial: true,
    isPremium: false
  },
  {
    id: 'task-management',
    name: 'Project Task Automation',
    description: 'Automatically create, assign, and track project tasks based on project milestones',
    category: 'productivity',
    complexity: 'beginner',
    estimatedSetupTime: 10,
    tags: ['tasks', 'project-management', 'automation'],
    icon: FileText,
    color: 'bg-green-100 border-green-300',
    preview: {
      nodeCount: 6,
      triggerType: 'schedule',
      actionTypes: ['create-task', 'assign', 'notify'],
    },
    template: {
      nodes: [],
      edges: [],
      settings: {}
    },
    usage: {
      downloads: 2100,
      rating: 4.9,
      reviews: 145
    },
    author: {
      name: 'Productivity Hub',
      verified: true
    },
    createdAt: '2024-01-10T00:00:00Z',
    updatedAt: '2024-01-18T00:00:00Z',
    version: '1.5.0',
    requirements: ['Task management system access'],
    documentation: 'Step-by-step guide for project automation...',
    isOfficial: true,
    isPremium: false
  },
  {
    id: 'customer-support',
    name: 'Customer Support Ticket Routing',
    description: 'Intelligent ticket routing based on content analysis and priority',
    category: 'support',
    complexity: 'advanced',
    estimatedSetupTime: 30,
    tags: ['support', 'ai', 'routing', 'helpdesk'],
    icon: MessageSquare,
    color: 'bg-purple-100 border-purple-300',
    preview: {
      nodeCount: 12,
      triggerType: 'webhook',
      actionTypes: ['ai-analysis', 'routing', 'notification', 'escalation'],
    },
    template: {
      nodes: [],
      edges: [],
      settings: {}
    },
    usage: {
      downloads: 890,
      rating: 4.7,
      reviews: 67
    },
    author: {
      name: 'Support Solutions',
      verified: true
    },
    createdAt: '2024-01-05T00:00:00Z',
    updatedAt: '2024-01-22T00:00:00Z',
    version: '3.0.0',
    requirements: ['Support system API', 'AI service integration'],
    documentation: 'Advanced configuration for AI-powered support...',
    isOfficial: false,
    isPremium: true
  },
  {
    id: 'lead-qualification',
    name: 'Lead Qualification Pipeline',
    description: 'Automated lead scoring and qualification based on behavior and demographics',
    category: 'sales',
    complexity: 'intermediate',
    estimatedSetupTime: 20,
    tags: ['sales', 'leads', 'scoring', 'crm'],
    icon: TrendingUp,
    color: 'bg-orange-100 border-orange-300',
    preview: {
      nodeCount: 10,
      triggerType: 'webhook',
      actionTypes: ['scoring', 'classification', 'crm-update', 'notification'],
    },
    template: {
      nodes: [],
      edges: [],
      settings: {}
    },
    usage: {
      downloads: 1450,
      rating: 4.6,
      reviews: 112
    },
    author: {
      name: 'Sales Automation Co.',
      verified: true
    },
    createdAt: '2024-01-08T00:00:00Z',
    updatedAt: '2024-01-19T00:00:00Z',
    version: '2.3.0',
    requirements: ['CRM integration', 'Lead database'],
    documentation: 'Complete lead qualification setup guide...',
    isOfficial: false,
    isPremium: false
  },
  {
    id: 'inventory-management',
    name: 'Inventory Reorder Automation',
    description: 'Automatically monitor inventory levels and trigger reorder processes',
    category: 'general',
    complexity: 'beginner',
    estimatedSetupTime: 12,
    tags: ['inventory', 'procurement', 'monitoring'],
    icon: Database,
    color: 'bg-yellow-100 border-yellow-300',
    preview: {
      nodeCount: 7,
      triggerType: 'schedule',
      actionTypes: ['monitor', 'condition', 'purchase-order', 'notification'],
    },
    template: {
      nodes: [],
      edges: [],
      settings: {}
    },
    usage: {
      downloads: 780,
      rating: 4.4,
      reviews: 45
    },
    author: {
      name: 'Operations Team',
      verified: false
    },
    createdAt: '2024-01-12T00:00:00Z',
    updatedAt: '2024-01-16T00:00:00Z',
    version: '1.2.0',
    requirements: ['Inventory system API', 'Supplier integration'],
    documentation: 'Inventory automation best practices...',
    isOfficial: true,
    isPremium: false
  },
  {
    id: 'social-media-posting',
    name: 'Social Media Content Scheduler',
    description: 'Schedule and publish content across multiple social media platforms',
    category: 'marketing',
    complexity: 'beginner',
    estimatedSetupTime: 8,
    tags: ['social-media', 'content', 'scheduling', 'marketing'],
    icon: Smartphone,
    color: 'bg-pink-100 border-pink-300',
    preview: {
      nodeCount: 5,
      triggerType: 'schedule',
      actionTypes: ['post', 'image-processing', 'analytics'],
    },
    template: {
      nodes: [],
      edges: [],
      settings: {}
    },
    usage: {
      downloads: 3200,
      rating: 4.9,
      reviews: 230
    },
    author: {
      name: 'Social Hub',
      verified: true
    },
    createdAt: '2024-01-03T00:00:00Z',
    updatedAt: '2024-01-21T00:00:00Z',
    version: '1.8.0',
    requirements: ['Social media API keys'],
    documentation: 'Social media automation guide...',
    isOfficial: true,
    isPremium: false
  }
]

const CATEGORIES = [
  { id: 'all', name: 'All Templates', icon: Grid, count: 0 },
  { id: 'productivity', name: 'Productivity', icon: FileText, count: 0 },
  { id: 'marketing', name: 'Marketing', icon: TrendingUp, count: 0 },
  { id: 'sales', name: 'Sales', icon: BarChart3, count: 0 },
  { id: 'support', name: 'Support', icon: MessageSquare, count: 0 },
  { id: 'devops', name: 'DevOps', icon: Code, count: 0 },
  { id: 'finance', name: 'Finance', icon: Calculator, count: 0 },
  { id: 'hr', name: 'HR', icon: Users, count: 0 },
  { id: 'general', name: 'General', icon: Settings, count: 0 }
]

export default function WorkflowTemplates({
  templates = WORKFLOW_TEMPLATES,
  onUseTemplate,
  onPreviewTemplate,
  className,
  showCategories = true,
  allowFiltering = true
}: WorkflowTemplatesProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [complexityFilter, setComplexityFilter] = useState('all')
  const [sortBy, setSortBy] = useState<'popular' | 'rating' | 'recent' | 'name'>('popular')
  const [showPremiumOnly, setShowPremiumOnly] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null)

  // Filter templates
  const filteredTemplates = templates
    .filter(template => {
      const matchesSearch = !searchTerm || 
        template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        template.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        template.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))

      const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory
      const matchesComplexity = complexityFilter === 'all' || template.complexity === complexityFilter
      const matchesPremium = !showPremiumOnly || template.isPremium

      return matchesSearch && matchesCategory && matchesComplexity && matchesPremium
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'popular':
          return b.usage.downloads - a.usage.downloads
        case 'rating':
          return b.usage.rating - a.usage.rating
        case 'recent':
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        case 'name':
          return a.name.localeCompare(b.name)
        default:
          return 0
      }
    })

  // Update category counts
  const categoriesWithCounts = CATEGORIES.map(category => ({
    ...category,
    count: category.id === 'all' 
      ? templates.length 
      : templates.filter(t => t.category === category.id).length
  }))

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'beginner': return 'bg-green-100 text-green-800'
      case 'intermediate': return 'bg-yellow-100 text-yellow-800'
      case 'advanced': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={cn(
          "h-3 w-3",
          i < Math.floor(rating) ? "text-yellow-400 fill-current" : "text-gray-300"
        )}
      />
    ))
  }

  const TemplateCard = ({ template }: { template: WorkflowTemplate }) => {
    const Icon = template.icon

    return (
      <Card className="transition-all hover:shadow-lg cursor-pointer group">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <div className={cn("p-2 rounded-lg", template.color)}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <CardTitle className="text-lg truncate">{template.name}</CardTitle>
                  {template.isOfficial && (
                    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                      Official
                    </Badge>
                  )}
                  {template.isPremium && (
                    <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700">
                      Premium
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-sm mb-2 line-clamp-2">
                  {template.description}
                </CardDescription>
                <div className="flex items-center gap-2 mb-2">
                  <Badge className={getComplexityColor(template.complexity)}>
                    {template.complexity}
                  </Badge>
                  <Badge variant="outline">
                    <Clock className="h-3 w-3 mr-1" />
                    {template.estimatedSetupTime}m
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Preview Stats */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="text-center p-2 bg-muted rounded">
              <div className="font-medium">{template.preview.nodeCount}</div>
              <div className="text-muted-foreground">Nodes</div>
            </div>
            <div className="text-center p-2 bg-muted rounded">
              <div className="font-medium">{template.usage.downloads}</div>
              <div className="text-muted-foreground">Downloads</div>
            </div>
            <div className="text-center p-2 bg-muted rounded">
              <div className="flex justify-center mb-1">
                {renderStars(template.usage.rating)}
              </div>
              <div className="text-muted-foreground">{template.usage.reviews} reviews</div>
            </div>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1">
            {template.tags.slice(0, 4).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
            {template.tags.length > 4 && (
              <Badge variant="secondary" className="text-xs">
                +{template.tags.length - 4} more
              </Badge>
            )}
          </div>

          <Separator />

          {/* Author and Date */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <span>by {template.author.name}</span>
              {template.author.verified && (
                <Shield className="h-3 w-3 text-blue-500" />
              )}
            </div>
            <span>v{template.version}</span>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedTemplate(template)}
              className="flex-1"
            >
              <Eye className="h-3 w-3 mr-1" />
              Preview
            </Button>
            <Button
              size="sm"
              onClick={() => onUseTemplate(template)}
              className="flex-1"
            >
              <Plus className="h-3 w-3 mr-1" />
              Use Template
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-2">Workflow Templates</h2>
        <p className="text-muted-foreground">
          Get started quickly with pre-built workflow templates for common automation scenarios
        </p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        {showCategories && (
          <div className="w-64 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Categories</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {categoriesWithCounts.map((category) => {
                  const Icon = category.icon
                  return (
                    <Button
                      key={category.id}
                      variant={selectedCategory === category.id ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => setSelectedCategory(category.id)}
                      className="w-full justify-start"
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {category.name}
                      <Badge variant="outline" className="ml-auto text-xs">
                        {category.count}
                      </Badge>
                    </Button>
                  )
                })}
              </CardContent>
            </Card>

            {allowFiltering && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Filters</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <label className="text-sm font-medium">Complexity</label>
                    <Select value={complexityFilter} onValueChange={setComplexityFilter}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Levels</SelectItem>
                        <SelectItem value="beginner">Beginner</SelectItem>
                        <SelectItem value="intermediate">Intermediate</SelectItem>
                        <SelectItem value="advanced">Advanced</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="premium-only"
                      checked={showPremiumOnly}
                      onChange={(e) => setShowPremiumOnly(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <label htmlFor="premium-only" className="text-sm">
                      Premium templates only
                    </label>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 space-y-4">
          {/* Search and Sort */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="popular">Most Popular</SelectItem>
                <SelectItem value="rating">Highest Rated</SelectItem>
                <SelectItem value="recent">Most Recent</SelectItem>
                <SelectItem value="name">Name A-Z</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Templates Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredTemplates.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <Zap className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">No templates found</h3>
                <p className="text-muted-foreground">
                  Try adjusting your search or filter criteria
                </p>
              </div>
            ) : (
              filteredTemplates.map((template) => (
                <TemplateCard key={template.id} template={template} />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Template Preview Dialog */}
      <Dialog open={!!selectedTemplate} onOpenChange={() => setSelectedTemplate(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {selectedTemplate?.icon && (
                <div className={cn("p-2 rounded-lg", selectedTemplate.color)}>
                  <selectedTemplate.icon className="h-5 w-5" />
                </div>
              )}
              {selectedTemplate?.name}
            </DialogTitle>
          </DialogHeader>

          {selectedTemplate && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-6">
                {/* Template Info */}
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium mb-2">Description</h4>
                    <p className="text-sm text-muted-foreground">
                      {selectedTemplate.description}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Details</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Complexity:</span>
                        <Badge className={getComplexityColor(selectedTemplate.complexity)}>
                          {selectedTemplate.complexity}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Setup Time:</span>
                        <span>{selectedTemplate.estimatedSetupTime} minutes</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Nodes:</span>
                        <span>{selectedTemplate.preview.nodeCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Version:</span>
                        <span>v{selectedTemplate.version}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Requirements */}
                <div>
                  <h4 className="font-medium mb-2">Requirements</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    {selectedTemplate.requirements.map((req, index) => (
                      <li key={index}>{req}</li>
                    ))}
                  </ul>
                </div>

                <Separator />

                {/* Workflow Preview */}
                <div>
                  <h4 className="font-medium mb-2">Workflow Overview</h4>
                  <div className="bg-muted rounded-lg p-4">
                    <div className="grid grid-cols-3 gap-4 text-center text-sm">
                      <div>
                        <div className="font-medium">Trigger</div>
                        <Badge variant="outline" className="mt-1">
                          {selectedTemplate.preview.triggerType}
                        </Badge>
                      </div>
                      <div>
                        <div className="font-medium">Actions</div>
                        <div className="mt-1 space-x-1">
                          {selectedTemplate.preview.actionTypes.slice(0, 2).map((action) => (
                            <Badge key={action} variant="secondary" className="text-xs">
                              {action}
                            </Badge>
                          ))}
                          {selectedTemplate.preview.actionTypes.length > 2 && (
                            <Badge variant="secondary" className="text-xs">
                              +{selectedTemplate.preview.actionTypes.length - 2}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="font-medium">Total Steps</div>
                        <div className="mt-1 text-lg font-bold">
                          {selectedTemplate.preview.nodeCount}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <h4 className="font-medium mb-2">Tags</h4>
                  <div className="flex flex-wrap gap-1">
                    {selectedTemplate.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Usage Stats */}
                <div>
                  <h4 className="font-medium mb-2">Usage Statistics</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-muted rounded">
                      <div className="text-lg font-bold">{selectedTemplate.usage.downloads}</div>
                      <div className="text-sm text-muted-foreground">Downloads</div>
                    </div>
                    <div className="text-center p-3 bg-muted rounded">
                      <div className="flex justify-center mb-1">
                        {renderStars(selectedTemplate.usage.rating)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {selectedTemplate.usage.rating}/5 rating
                      </div>
                    </div>
                    <div className="text-center p-3 bg-muted rounded">
                      <div className="text-lg font-bold">{selectedTemplate.usage.reviews}</div>
                      <div className="text-sm text-muted-foreground">Reviews</div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setSelectedTemplate(null)}>
                    Close
                  </Button>
                  <Button onClick={() => {
                    onUseTemplate(selectedTemplate)
                    setSelectedTemplate(null)
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Use This Template
                  </Button>
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}