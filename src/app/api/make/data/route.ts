import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export async function GET(req: NextRequest) {
  try {
    // Verify API token if provided
    const apiToken = req.headers.get('authorization')
    if (process.env.MAKE_API_TOKEN && apiToken !== `Bearer ${process.env.MAKE_API_TOKEN}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(req.url)
    const dataType = searchParams.get('type')
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Example data structure - replace with your actual data source
    let data: any = {}

    switch (dataType) {
      case 'users':
        data = await getUsersData(limit, offset)
        break
      
      case 'orders':
        data = await getOrdersData(limit, offset)
        break
      
      case 'products':
        data = await getProductsData(limit, offset)
        break
      
      case 'analytics':
        data = await getAnalyticsData()
        break
      
      default:
        data = await getGeneralData(limit, offset)
    }

    return NextResponse.json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
      pagination: {
        limit,
        offset,
        total: data.total || 0
      }
    })
  } catch (error: any) {
    console.error('Error fetching data for Make.com:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch data',
        message: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    // Verify API token
    const apiToken = req.headers.get('authorization')
    if (process.env.MAKE_API_TOKEN && apiToken !== `Bearer ${process.env.MAKE_API_TOKEN}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { action, data } = body

    let result: any = {}

    switch (action) {
      case 'create_user':
        result = await createUser(data)
        break
      
      case 'update_order':
        result = await updateOrder(data)
        break
      
      case 'send_notification':
        result = await sendNotification(data)
        break
      
      case 'sync_data':
        result = await syncExternalData(data)
        break
      
      default:
        return NextResponse.json(
          { error: 'Unknown action', action },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      result,
      action,
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    console.error('Error processing Make.com data action:', error)
    return NextResponse.json(
      { 
        error: 'Failed to process action',
        message: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

// Data fetching functions
async function getUsersData(limit: number, offset: number) {
  // Replace with actual database query
  return {
    users: [
      { id: 1, name: 'John Doe', email: 'john@example.com', createdAt: '2024-01-01' },
      { id: 2, name: 'Jane Smith', email: 'jane@example.com', createdAt: '2024-01-02' }
    ].slice(offset, offset + limit),
    total: 2
  }
}

async function getOrdersData(limit: number, offset: number) {
  // Replace with actual database query
  return {
    orders: [
      { 
        id: 'order_1', 
        userId: 1, 
        amount: 99.99, 
        status: 'completed', 
        createdAt: '2024-01-01' 
      },
      { 
        id: 'order_2', 
        userId: 2, 
        amount: 149.99, 
        status: 'pending', 
        createdAt: '2024-01-02' 
      }
    ].slice(offset, offset + limit),
    total: 2
  }
}

async function getProductsData(limit: number, offset: number) {
  // Replace with actual database query
  return {
    products: [
      { 
        id: 'prod_1', 
        name: 'Product A', 
        price: 99.99, 
        stock: 50, 
        category: 'electronics' 
      },
      { 
        id: 'prod_2', 
        name: 'Product B', 
        price: 149.99, 
        stock: 25, 
        category: 'accessories' 
      }
    ].slice(offset, offset + limit),
    total: 2
  }
}

async function getAnalyticsData() {
  // Replace with actual analytics data
  return {
    totalUsers: 1250,
    totalOrders: 895,
    totalRevenue: 45670.50,
    averageOrderValue: 51.05,
    topProducts: [
      { id: 'prod_1', name: 'Product A', sales: 125 },
      { id: 'prod_2', name: 'Product B', sales: 87 }
    ],
    monthlyStats: {
      users: 125,
      orders: 89,
      revenue: 4567.05
    }
  }
}

async function getGeneralData(limit: number, offset: number) {
  // Default data structure for Make.com
  return {
    items: [
      { id: 1, type: 'general', value: 'Sample data 1', timestamp: new Date().toISOString() },
      { id: 2, type: 'general', value: 'Sample data 2', timestamp: new Date().toISOString() }
    ].slice(offset, offset + limit),
    total: 2
  }
}

// Action functions
async function createUser(userData: any) {
  console.log('Creating user via Make.com:', userData)
  // Replace with actual user creation logic
  return {
    id: Date.now(),
    ...userData,
    createdAt: new Date().toISOString()
  }
}

async function updateOrder(orderData: any) {
  console.log('Updating order via Make.com:', orderData)
  // Replace with actual order update logic
  return {
    id: orderData.id,
    status: orderData.status,
    updatedAt: new Date().toISOString()
  }
}

async function sendNotification(notificationData: any) {
  console.log('Sending notification via Make.com:', notificationData)
  // Replace with actual notification logic
  return {
    id: Date.now().toString(),
    status: 'sent',
    recipients: notificationData.recipients,
    sentAt: new Date().toISOString()
  }
}

async function syncExternalData(syncData: any) {
  console.log('Syncing external data via Make.com:', syncData)
  // Replace with actual data sync logic
  return {
    syncId: Date.now().toString(),
    recordsProcessed: syncData.records?.length || 0,
    status: 'completed',
    syncedAt: new Date().toISOString()
  }
}