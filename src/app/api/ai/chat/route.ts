import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-auth-tenant-id')
    const userId = request.headers.get('x-auth-user-id')

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID is required' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { message, context } = body as {
      message: string
      context?: string
    }

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // Fetch tenant AI settings
    const settings = await db.tenantSettings.findUnique({
      where: { tenantId },
    })

    if (!settings || !settings.aiEnabled) {
      return NextResponse.json(
        { error: 'AI assistant is not enabled for this tenant' },
        { status: 403 }
      )
    }

    if (!settings.aiApiKey) {
      return NextResponse.json(
        { error: 'AI API key is not configured' },
        { status: 400 }
      )
    }

    // Get tenant name for system prompt
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    })

    const tenantName = tenant?.name || 'this organization'

    // Build system prompt with tenant name replacement
    let systemPrompt = settings.aiSystemPrompt ||
      'You are a helpful asset management assistant for {tenantName}.'
    systemPrompt = systemPrompt.replace(/{tenantName}/g, tenantName)

    // Build messages array
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
    ]

    // Add context if provided
    if (context && typeof context === 'string' && context.trim().length > 0) {
      messages.push({
        role: 'system',
        content: `Here is the current context about the user's assets for your reference:\n\n${context}`,
      })
    }

    // Add user message
    messages.push({ role: 'user', content: message.trim() })

    // Determine API endpoint based on provider
    let apiEndpoint: string
    let apiKey = settings.aiApiKey

    switch (settings.aiProvider) {
      case 'openai':
        apiEndpoint = 'https://api.openai.com/v1/chat/completions'
        break
      default:
        apiEndpoint = 'https://api.openai.com/v1/chat/completions'
    }

    const model = settings.aiModel || 'gpt-4o-mini'
    const temperature = settings.aiTemperature ?? 0.7

    // Call OpenAI-compatible API
    const apiResponse = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: 1024,
      }),
    })

    // Handle API errors
    if (!apiResponse.ok) {
      const errorBody = await apiResponse.text()
      let errorMessage = 'Failed to get AI response'
      let statusCode = 502

      try {
        const parsed = JSON.parse(errorBody)
        const apiError = parsed.error || parsed

        if (apiResponse.status === 401) {
          errorMessage = 'Invalid API key. Please update your AI configuration.'
          statusCode = 400
        } else if (apiResponse.status === 429) {
          errorMessage = 'API quota exceeded. Please check your plan or try again later.'
          statusCode = 429
        } else if (apiResponse.status === 400) {
          errorMessage = apiError.message || 'Invalid request to AI provider'
          statusCode = 400
        } else {
          errorMessage = apiError.message || `AI provider error: ${apiResponse.status}`
        }
      } catch {
        errorMessage = `AI provider returned status ${apiResponse.status}`
      }

      console.error('AI API error:', errorBody)
      return NextResponse.json({ error: errorMessage }, { status: statusCode })
    }

    const apiData = await apiResponse.json()
    const aiResponse = apiData.choices?.[0]?.message?.content

    if (!aiResponse) {
      return NextResponse.json(
        { error: 'No response received from AI' },
        { status: 502 }
      )
    }

    return NextResponse.json({ response: aiResponse })
  } catch (error) {
    console.error('AI chat error:', error)
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return NextResponse.json(
        { error: 'Failed to connect to AI provider' },
        { status: 502 }
      )
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
