/**
 * Database utility functions for Supabase integration
 * This replaces the previous Prisma approach with direct Supabase queries
 */

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

// Types for our database models
export interface Profile {
  id: string
  email: string
  first_name?: string
  last_name?: string
  image_url?: string
  stripe_customer_id?: string
  waitlist_approved: boolean
  waitlist_approved_at?: string
  created_at: string
  updated_at: string
}

export interface Subscription {
  id: string
  user_id: string
  stripe_subscription_id: string
  stripe_price_id: string
  status: 'active' | 'canceled' | 'past_due' | 'unpaid' | 'trialing'
  current_period_start?: string
  current_period_end?: string
  cancel_at_period_end: boolean
  trial_end?: string
  created_at: string
  updated_at: string
}

export interface Invoice {
  id: string
  user_id: string
  stripe_invoice_id: string
  invoice_number: string
  amount_paid: number
  amount_due: number
  currency: string
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible'
  hosted_invoice_url?: string
  invoice_pdf?: string
  custom_pdf_url?: string
  line_items: any[]
  created_at: string
  updated_at: string
}

export interface WaitlistEntry {
  id: string
  email: string
  name?: string
  company?: string
  message?: string
  approved: boolean
  approved_at?: string
  approved_by?: string
  user_id?: string
  created_at: string
  updated_at: string
}

export interface Task {
  id: string
  user_id: string
  title: string
  content?: string
  completed: boolean
  due_date?: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  created_at: string
  updated_at: string
}

export interface Workflow {
  id: string
  user_id: string
  name: string
  description?: string
  n8n_id?: string
  make_id?: string
  active: boolean
  trigger_type: string
  actions: any[]
  created_at: string
  updated_at: string
}

export interface WorkflowExecution {
  id: string
  workflow_id: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  input_data?: any
  output_data?: any
  error_message?: string
  started_at: string
  completed_at?: string
}

export interface AIContext {
  id: string
  user_id: string
  name: string
  type: 'mcp' | 'a2a' | 'copilot' | 'agui'
  context_data: any
  metadata?: any
  created_at: string
  updated_at: string
}

export interface AgentTask {
  id: string
  user_id: string
  agent_id: string
  description: string
  status: string
  artifacts?: any
  result?: any
  created_at: string
  updated_at: string
}

export interface BlogPost {
  id: string
  title: string
  slug: string
  content: string
  excerpt?: string
  published: boolean
  wordpress_id?: string
  meta_title?: string
  meta_description?: string
  created_at: string
  updated_at: string
}

export interface APIKey {
  id: string
  user_id: string
  name: string
  key_hash: string
  key_preview: string
  permissions: string[]
  last_used?: string
  expires_at?: string
  created_at: string
  updated_at: string
}

// Database service class
export class DatabaseService {
  public supabase: ReturnType<typeof createClient>
  
  constructor(supabase: ReturnType<typeof createClient>) {
    this.supabase = supabase
  }

  // Profile operations
  async getProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null // No rows returned
      console.error('Error fetching profile:', error)
      return null
    }

    return data
  }

  async getProfileByStripeCustomerId(stripeCustomerId: string): Promise<Profile | null> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('stripe_customer_id', stripeCustomerId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null // No rows returned
      console.error('Error fetching profile by stripe customer id:', error)
      return null
    }

    return data
  }

  async createProfile(profile: Omit<Profile, 'created_at' | 'updated_at'>): Promise<Profile | null> {
    const { data, error } = await this.supabase
      .from('profiles')
      .insert(profile)
      .select()
      .single()

    if (error) {
      console.error('Error creating profile:', error)
      return null
    }

    return data
  }

  async updateProfile(userId: string, updates: Partial<Profile>): Promise<Profile | null> {
    const { data, error } = await this.supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single()

    if (error) {
      console.error('Error updating profile:', error)
      return null
    }

    return data
  }

  // Subscription operations
  async getActiveSubscription(userId: string): Promise<Subscription | null> {
    const { data, error } = await this.supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null // No rows returned
      console.error('Error fetching subscription:', error)
      return null
    }

    return data
  }

  async createSubscription(subscription: Omit<Subscription, 'id' | 'created_at' | 'updated_at'>): Promise<Subscription | null> {
    const { data, error } = await this.supabase
      .from('subscriptions')
      .insert(subscription)
      .select()
      .single()

    if (error) {
      console.error('Error creating subscription:', error)
      return null
    }

    return data
  }

  async updateSubscription(subscriptionId: string, updates: Partial<Subscription>): Promise<Subscription | null> {
    const { data, error } = await this.supabase
      .from('subscriptions')
      .update(updates)
      .eq('stripe_subscription_id', subscriptionId)
      .select()
      .single()

    if (error) {
      console.error('Error updating subscription:', error)
      return null
    }

    return data
  }

  async updateInvoice(invoiceId: string, updates: Partial<Invoice>): Promise<Invoice | null> {
    const { data, error } = await this.supabase
      .from('invoices')
      .update(updates)
      .eq('stripe_invoice_id', invoiceId)
      .select()
      .single()

    if (error) {
      console.error('Error updating invoice:', error)
      return null
    }

    return data
  }

  // Invoice operations
  async getUserInvoices(userId: string, limit = 50): Promise<Invoice[]> {
    const { data, error } = await this.supabase
      .from('invoices')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching invoices:', error)
      return []
    }

    return data || []
  }

  async createInvoice(invoice: Omit<Invoice, 'id' | 'created_at' | 'updated_at'>): Promise<Invoice | null> {
    const { data, error } = await this.supabase
      .from('invoices')
      .insert(invoice)
      .select()
      .single()

    if (error) {
      console.error('Error creating invoice:', error)
      return null
    }

    return data
  }

  // Waitlist operations
  async addToWaitlist(entry: Omit<WaitlistEntry, 'id' | 'created_at' | 'updated_at' | 'approved' | 'approved_at' | 'approved_by'>): Promise<WaitlistEntry | null> {
    const { data, error } = await this.supabase
      .from('waitlist_entries')
      .insert(entry)
      .select()
      .single()

    if (error) {
      console.error('Error adding to waitlist:', error)
      return null
    }

    return data
  }

  async getWaitlistEntry(email: string): Promise<WaitlistEntry | null> {
    const { data, error } = await this.supabase
      .from('waitlist_entries')
      .select('*')
      .eq('email', email)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null // No rows returned
      console.error('Error fetching waitlist entry:', error)
      return null
    }

    return data
  }

  async approveWaitlistEntry(email: string, approvedBy: string): Promise<WaitlistEntry | null> {
    const { data, error } = await this.supabase
      .from('waitlist_entries')
      .update({
        approved: true,
        approved_at: new Date().toISOString(),
        approved_by: approvedBy,
      })
      .eq('email', email)
      .select()
      .single()

    if (error) {
      console.error('Error approving waitlist entry:', error)
      return null
    }

    return data
  }

  // Task operations
  async getUserTasks(userId: string): Promise<Task[]> {
    const { data, error } = await this.supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching tasks:', error)
      return []
    }

    return data || []
  }

  async createTask(task: Omit<Task, 'id' | 'created_at' | 'updated_at'>): Promise<Task | null> {
    const { data, error } = await this.supabase
      .from('tasks')
      .insert(task)
      .select()
      .single()

    if (error) {
      console.error('Error creating task:', error)
      return null
    }

    return data
  }

  async updateTask(taskId: string, updates: Partial<Task>): Promise<Task | null> {
    const { data, error } = await this.supabase
      .from('tasks')
      .update(updates)
      .eq('id', taskId)
      .select()
      .single()

    if (error) {
      console.error('Error updating task:', error)
      return null
    }

    return data
  }

  // Workflow operations
  async getUserWorkflows(userId: string): Promise<Workflow[]> {
    const { data, error } = await this.supabase
      .from('workflows')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching workflows:', error)
      return []
    }

    return data || []
  }

  async createWorkflow(workflow: Omit<Workflow, 'id' | 'created_at' | 'updated_at'>): Promise<Workflow | null> {
    const { data, error } = await this.supabase
      .from('workflows')
      .insert(workflow)
      .select()
      .single()

    if (error) {
      console.error('Error creating workflow:', error)
      return null
    }

    return data
  }

  // AI Context operations
  async getUserAIContexts(userId: string, type?: string): Promise<AIContext[]> {
    let query = this.supabase
      .from('ai_contexts')
      .select('*')
      .eq('user_id', userId)

    if (type) {
      query = query.eq('type', type)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching AI contexts:', error)
      return []
    }

    return data || []
  }

  async createAIContext(context: Omit<AIContext, 'id' | 'created_at' | 'updated_at'>): Promise<AIContext | null> {
    const { data, error } = await this.supabase
      .from('ai_contexts')
      .insert(context)
      .select()
      .single()

    if (error) {
      console.error('Error creating AI context:', error)
      return null
    }

    return data
  }

  // Blog operations
  async getPublishedBlogPosts(): Promise<BlogPost[]> {
    const { data, error } = await this.supabase
      .from('blog_posts')
      .select('*')
      .eq('published', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching blog posts:', error)
      return []
    }

    return data || []
  }

  async getBlogPostBySlug(slug: string): Promise<BlogPost | null> {
    const { data, error } = await this.supabase
      .from('blog_posts')
      .select('*')
      .eq('slug', slug)
      .eq('published', true)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null // No rows returned
      console.error('Error fetching blog post:', error)
      return null
    }

    return data
  }

  async getBlogPostByWordPressId(wordpressId: string): Promise<BlogPost | null> {
    const { data, error } = await this.supabase
      .from('blog_posts')
      .select('*')
      .eq('wordpress_id', wordpressId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null // No rows returned
      console.error('Error fetching blog post by WordPress ID:', error)
      return null
    }

    return data
  }

  async createBlogPost(post: Omit<BlogPost, 'id' | 'created_at' | 'updated_at'>): Promise<BlogPost | null> {
    const { data, error } = await this.supabase
      .from('blog_posts')
      .insert(post)
      .select()
      .single()

    if (error) {
      console.error('Error creating blog post:', error)
      return null
    }

    return data
  }

  async updateBlogPost(postId: string, updates: Partial<BlogPost>): Promise<BlogPost | null> {
    const { data, error } = await this.supabase
      .from('blog_posts')
      .update(updates)
      .eq('id', postId)
      .select()
      .single()

    if (error) {
      console.error('Error updating blog post:', error)
      return null
    }

    return data
  }
}

// Helper function to create database service with server-side Supabase client
export async function createDatabaseService() {
  const supabase = await createServerSupabaseClient()
  return new DatabaseService(supabase)
}

// Helper function to create database service with client-side Supabase client (for client components)
export function createClientDatabaseService(supabase: ReturnType<typeof createClient>) {
  return new DatabaseService(supabase)
}