/**
 * WordPress Posts API Endpoint
 * Provides access to WordPress posts with local caching
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createWordPressClient } from '@/lib/wordpress'
import { createDatabaseService } from '@/lib/database'

// GET - Get posts from WordPress or local cache
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const source = searchParams.get('source') || 'local' // 'local' or 'wordpress'
    const page = parseInt(searchParams.get('page') || '1')
    const perPage = parseInt(searchParams.get('per_page') || '10')
    const search = searchParams.get('search')
    const category = searchParams.get('category')

    if (source === 'wordpress') {
      // Fetch directly from WordPress
      const wp = createWordPressClient()
      
      const params: any = {
        page,
        per_page: perPage,
        status: 'publish',
        orderby: 'date',
        order: 'desc'
      }

      if (search) params.search = search
      if (category) {
        // Convert category slug to ID if needed
        const categories = await wp.getCategories({ slug: category })
        if (categories.length > 0) {
          params.categories = [categories[0].id]
        }
      }

      const posts = await wp.getPosts(params)
      
      return NextResponse.json({
        posts: posts.map(post => ({
          id: post.id,
          title: post.title.rendered,
          slug: post.slug,
          excerpt: post.excerpt.rendered,
          content: post.content.rendered,
          date: post.date,
          modified: post.modified,
          author: post.author,
          categories: post.categories,
          tags: post.tags,
          featured_media: post.featured_media,
          link: post.link,
          seo: post.yoast_head_json
        })),
        pagination: {
          page,
          per_page: perPage,
          total: posts.length,
          source: 'wordpress'
        }
      })
    } else {
      // Fetch from local database
      const db = await createDatabaseService()
      const posts = await db.getPublishedBlogPosts()
      
      // Apply search filter if provided
      let filteredPosts = posts
      if (search) {
        const searchLower = search.toLowerCase()
        filteredPosts = posts.filter(post => 
          post.title.toLowerCase().includes(searchLower) ||
          post.content.toLowerCase().includes(searchLower) ||
          (post.excerpt && post.excerpt.toLowerCase().includes(searchLower))
        )
      }

      // Apply pagination
      const startIndex = (page - 1) * perPage
      const endIndex = startIndex + perPage
      const paginatedPosts = filteredPosts.slice(startIndex, endIndex)

      return NextResponse.json({
        posts: paginatedPosts.map(post => ({
          id: post.id,
          wordpress_id: post.wordpress_id,
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          content: post.content,
          published: post.published,
          meta_title: post.meta_title,
          meta_description: post.meta_description,
          created_at: post.created_at,
          updated_at: post.updated_at
        })),
        pagination: {
          page,
          per_page: perPage,
          total: filteredPosts.length,
          total_pages: Math.ceil(filteredPosts.length / perPage),
          source: 'local'
        }
      })
    }
  } catch (error) {
    console.error('Posts API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch posts' },
      { status: 500 }
    )
  }
}

// POST - Create new post (requires authentication)
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { title, content, excerpt, status = 'draft', categories, tags, meta } = body

    if (!title || !content) {
      return NextResponse.json(
        { error: 'Title and content are required' },
        { status: 400 }
      )
    }

    // Create post in WordPress
    const wp = createWordPressClient()
    const wpPost = await wp.createPost({
      title,
      content,
      excerpt,
      status,
      categories,
      tags,
      meta
    })

    // Also save to local database if published
    if (status === 'publish') {
      const db = await createDatabaseService()
      await db.createBlogPost({
        wordpress_id: wpPost.id.toString(),
        title: wpPost.title.rendered,
        slug: wpPost.slug,
        content: wpPost.content.rendered,
        excerpt: wpPost.excerpt.rendered,
        published: true,
        meta_title: meta?.title,
        meta_description: meta?.description
      })
    }

    return NextResponse.json({
      success: true,
      post: {
        id: wpPost.id,
        title: wpPost.title.rendered,
        slug: wpPost.slug,
        status: wpPost.status,
        link: wpPost.link
      }
    })
  } catch (error) {
    console.error('Post creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create post' },
      { status: 500 }
    )
  }
}