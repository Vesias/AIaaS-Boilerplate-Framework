/**
 * WordPress Headless CMS Integration
 * Provides content management and blog functionality
 */

// WordPress API Configuration
export interface WordPressConfig {
  apiUrl: string
  username: string
  password: string // Application password
  basicAuth?: string // Base64 encoded username:password
}

// WordPress Post Types
export interface WordPressPost {
  id: number
  date: string
  date_gmt: string
  modified: string
  modified_gmt: string
  slug: string
  status: 'publish' | 'draft' | 'private' | 'pending'
  type: string
  link: string
  title: {
    rendered: string
  }
  content: {
    rendered: string
    protected: boolean
  }
  excerpt: {
    rendered: string
    protected: boolean
  }
  author: number
  featured_media: number
  comment_status: 'open' | 'closed'
  ping_status: 'open' | 'closed'
  sticky: boolean
  template: string
  format: string
  meta: any[]
  categories: number[]
  tags: number[]
  yoast_head?: string
  yoast_head_json?: {
    title?: string
    description?: string
    og_title?: string
    og_description?: string
    og_image?: Array<{
      url: string
      width: number
      height: number
    }>
  }
}

// WordPress Media
export interface WordPressMedia {
  id: number
  date: string
  slug: string
  type: string
  link: string
  title: {
    rendered: string
  }
  author: number
  comment_status: string
  ping_status: string
  template: string
  meta: any[]
  description: {
    rendered: string
  }
  caption: {
    rendered: string
  }
  alt_text: string
  media_type: 'image' | 'video' | 'audio' | 'file'
  mime_type: string
  media_details: {
    width?: number
    height?: number
    file?: string
    sizes?: {
      [key: string]: {
        file: string
        width: number
        height: number
        mime_type: string
        source_url: string
      }
    }
  }
  source_url: string
}

// WordPress Category
export interface WordPressCategory {
  id: number
  count: number
  description: string
  link: string
  name: string
  slug: string
  taxonomy: string
  parent: number
  meta: any[]
}

// WordPress Tag
export interface WordPressTag {
  id: number
  count: number
  description: string
  link: string
  name: string
  slug: string
  taxonomy: string
  meta: any[]
}

// WordPress User
export interface WordPressUser {
  id: number
  name: string
  url: string
  description: string
  link: string
  slug: string
  avatar_urls: {
    [size: string]: string
  }
  meta: any[]
}

// WordPress API Client
export class WordPressClient {
  private config: WordPressConfig
  private baseUrl: string
  private authHeader: string

  constructor(config: WordPressConfig) {
    this.config = config
    this.baseUrl = config.apiUrl.endsWith('/') ? config.apiUrl : `${config.apiUrl}/`
    
    // Setup authentication
    if (config.basicAuth) {
      this.authHeader = `Basic ${config.basicAuth}`
    } else {
      const credentials = Buffer.from(`${config.username}:${config.password}`).toString('base64')
      this.authHeader = `Basic ${credentials}`
    }
  }

  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}wp-json/wp/v2/${endpoint}`
    
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'Authorization': this.authHeader,
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`WordPress API error: ${response.status} - ${error}`)
    }

    return response.json() as T
  }

  // Posts Management
  async getPosts(params: {
    page?: number
    per_page?: number
    search?: string
    author?: number
    categories?: number[]
    tags?: number[]
    status?: string
    orderby?: 'date' | 'id' | 'include' | 'title' | 'slug'
    order?: 'asc' | 'desc'
  } = {}): Promise<WordPressPost[]> {
    const searchParams = new URLSearchParams()
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          searchParams.append(key, value.join(','))
        } else {
          searchParams.append(key, value.toString())
        }
      }
    })

    const endpoint = `posts${searchParams.toString() ? `?${searchParams.toString()}` : ''}`
    return this.makeRequest<WordPressPost[]>(endpoint)
  }

  async getPost(id: number, password?: string): Promise<WordPressPost> {
    const params = password ? `?password=${encodeURIComponent(password)}` : ''
    return this.makeRequest<WordPressPost>(`posts/${id}${params}`)
  }

  async getPostBySlug(slug: string): Promise<WordPressPost | null> {
    const posts = await this.getPosts({ slug } as any)
    return posts.length > 0 ? posts[0] : null
  }

  async createPost(post: {
    title: string
    content: string
    excerpt?: string
    status?: 'publish' | 'draft' | 'private' | 'pending'
    author?: number
    categories?: number[]
    tags?: number[]
    featured_media?: number
    meta?: any
  }): Promise<WordPressPost> {
    return this.makeRequest<WordPressPost>('posts', {
      method: 'POST',
      body: JSON.stringify(post),
    })
  }

  async updatePost(id: number, updates: Partial<{
    title: string
    content: string
    excerpt: string
    status: 'publish' | 'draft' | 'private' | 'pending'
    author: number
    categories: number[]
    tags: number[]
    featured_media: number
    meta: any
  }>): Promise<WordPressPost> {
    return this.makeRequest<WordPressPost>(`posts/${id}`, {
      method: 'POST',
      body: JSON.stringify(updates),
    })
  }

  async deletePost(id: number, force: boolean = false): Promise<{ deleted: boolean }> {
    const params = force ? '?force=true' : ''
    return this.makeRequest<{ deleted: boolean }>(`posts/${id}${params}`, {
      method: 'DELETE',
    })
  }

  // Media Management
  async getMedia(params: {
    page?: number
    per_page?: number
    search?: string
    author?: number
    parent?: number
    media_type?: 'image' | 'video' | 'audio' | 'file'
    mime_type?: string
  } = {}): Promise<WordPressMedia[]> {
    const searchParams = new URLSearchParams()
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, value.toString())
      }
    })

    const endpoint = `media${searchParams.toString() ? `?${searchParams.toString()}` : ''}`
    return this.makeRequest<WordPressMedia[]>(endpoint)
  }

  async getMediaItem(id: number): Promise<WordPressMedia> {
    return this.makeRequest<WordPressMedia>(`media/${id}`)
  }

  async uploadMedia(file: File, data: {
    title?: string
    alt_text?: string
    caption?: string
    description?: string
    post?: number
  } = {}): Promise<WordPressMedia> {
    const formData = new FormData()
    formData.append('file', file)
    
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        formData.append(key, value.toString())
      }
    })

    const url = `${this.baseUrl}wp-json/wp/v2/media`
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': this.authHeader,
      },
      body: formData,
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`WordPress media upload error: ${response.status} - ${error}`)
    }

    return response.json() as WordPressMedia
  }

  // Categories Management
  async getCategories(params: {
    page?: number
    per_page?: number
    search?: string
    exclude?: number[]
    include?: number[]
    orderby?: 'id' | 'include' | 'name' | 'slug' | 'term_group' | 'description' | 'count'
    order?: 'asc' | 'desc'
    hide_empty?: boolean
    parent?: number
  } = {}): Promise<WordPressCategory[]> {
    const searchParams = new URLSearchParams()
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          searchParams.append(key, value.join(','))
        } else {
          searchParams.append(key, value.toString())
        }
      }
    })

    const endpoint = `categories${searchParams.toString() ? `?${searchParams.toString()}` : ''}`
    return this.makeRequest<WordPressCategory[]>(endpoint)
  }

  async createCategory(category: {
    name: string
    description?: string
    slug?: string
    parent?: number
    meta?: any
  }): Promise<WordPressCategory> {
    return this.makeRequest<WordPressCategory>('categories', {
      method: 'POST',
      body: JSON.stringify(category),
    })
  }

  // Tags Management
  async getTags(params: {
    page?: number
    per_page?: number
    search?: string
    exclude?: number[]
    include?: number[]
    orderby?: 'id' | 'include' | 'name' | 'slug' | 'term_group' | 'description' | 'count'
    order?: 'asc' | 'desc'
    hide_empty?: boolean
  } = {}): Promise<WordPressTag[]> {
    const searchParams = new URLSearchParams()
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          searchParams.append(key, value.join(','))
        } else {
          searchParams.append(key, value.toString())
        }
      }
    })

    const endpoint = `tags${searchParams.toString() ? `?${searchParams.toString()}` : ''}`
    return this.makeRequest<WordPressTag[]>(endpoint)
  }

  async createTag(tag: {
    name: string
    description?: string
    slug?: string
    meta?: any
  }): Promise<WordPressTag> {
    return this.makeRequest<WordPressTag>('tags', {
      method: 'POST',
      body: JSON.stringify(tag),
    })
  }

  // Users Management (read-only for security)
  async getUsers(params: {
    page?: number
    per_page?: number
    search?: string
    exclude?: number[]
    include?: number[]
    orderby?: 'id' | 'include' | 'name' | 'registered_date' | 'slug' | 'email' | 'url'
    order?: 'asc' | 'desc'
    roles?: string[]
  } = {}): Promise<WordPressUser[]> {
    const searchParams = new URLSearchParams()
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          searchParams.append(key, value.join(','))
        } else {
          searchParams.append(key, value.toString())
        }
      }
    })

    const endpoint = `users${searchParams.toString() ? `?${searchParams.toString()}` : ''}`
    return this.makeRequest<WordPressUser[]>(endpoint)
  }

  async getUser(id: number): Promise<WordPressUser> {
    return this.makeRequest<WordPressUser>(`users/${id}`)
  }

  // Health Check
  async healthCheck(): Promise<{
    status: 'ok' | 'error'
    version?: string
    error?: string
  }> {
    try {
      const response = await fetch(`${this.baseUrl}wp-json/wp/v2/`)
      
      if (response.ok) {
        const data = await response.json()
        return {
          status: 'ok',
          version: data.version || 'unknown'
        }
      } else {
        return {
          status: 'error',
          error: `HTTP ${response.status}`
        }
      }
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      }
    }
  }
}

// Factory function to create WordPress client
export function createWordPressClient(): WordPressClient {
  const config: WordPressConfig = {
    apiUrl: process.env.WORDPRESS_API_URL!,
    username: process.env.WORDPRESS_USERNAME!,
    password: process.env.WORDPRESS_PASSWORD!, // Application password
  }

  return new WordPressClient(config)
}

// WordPress sync utilities for local database
export interface BlogPostSync {
  wordpressId: number
  title: string
  slug: string
  content: string
  excerpt: string
  published: boolean
  metaTitle?: string
  metaDescription?: string
  createdAt: string
  updatedAt: string
}

export async function syncWordPressToLocal(db: any): Promise<{
  synced: number
  errors: string[]
}> {
  const wp = createWordPressClient()
  const errors: string[] = []
  let synced = 0

  try {
    // Get all published posts from WordPress
    const posts = await wp.getPosts({
      status: 'publish',
      per_page: 100, // Adjust as needed
      orderby: 'modified',
      order: 'desc'
    })

    for (const post of posts) {
      try {
        // Convert WordPress post to local format
        const blogPost: BlogPostSync = {
          wordpressId: post.id,
          title: post.title.rendered,
          slug: post.slug,
          content: post.content.rendered,
          excerpt: post.excerpt.rendered,
          published: post.status === 'publish',
          metaTitle: post.yoast_head_json?.title,
          metaDescription: post.yoast_head_json?.description,
          createdAt: post.date_gmt,
          updatedAt: post.modified_gmt
        }

        // Check if post already exists in local database
        const existingPost = await db.getBlogPostByWordPressId(post.id)

        if (existingPost) {
          // Update existing post if modified
          if (new Date(existingPost.updated_at) < new Date(blogPost.updatedAt)) {
            await db.updateBlogPost(existingPost.id, {
              title: blogPost.title,
              content: blogPost.content,
              excerpt: blogPost.excerpt,
              published: blogPost.published,
              meta_title: blogPost.metaTitle,
              meta_description: blogPost.metaDescription
            })
            synced++
          }
        } else {
          // Create new post
          await db.createBlogPost({
            wordpress_id: blogPost.wordpressId.toString(),
            title: blogPost.title,
            slug: blogPost.slug,
            content: blogPost.content,
            excerpt: blogPost.excerpt,
            published: blogPost.published,
            meta_title: blogPost.metaTitle,
            meta_description: blogPost.metaDescription
          })
          synced++
        }
      } catch (error) {
        errors.push(`Error syncing post ${post.id}: ${error.message}`)
      }
    }
  } catch (error) {
    errors.push(`WordPress sync error: ${error.message}`)
  }

  return { synced, errors }
}