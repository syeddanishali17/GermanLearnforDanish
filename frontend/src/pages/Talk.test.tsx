import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ConversationDetail } from '../lib/types'
import { ConversationPage } from './Talk'

const CONV: ConversationDetail = {
  id: 'a1-test',
  slug: 'a1-test',
  cefr: 'A1',
  week: 1,
  title: 'Test',
  title_de: 'Testgespräch',
  partner: 'Anna',
  setting: 'Somewhere',
  register: 'informal',
  turns: 3,
  practised: 0,
  readiness: 'ready',
  goal: 'Say hello',
  patterns: [],
  turns_list: [
    { who: 'Anna', de: 'Hallo! Wie geht’s?', en: 'Hi! How are you?' },
    { who: 'Du', de: 'Gut, danke. Und dir?', en: 'Good, thanks. And you?', alt: ['Super, danke!'] },
    { who: 'Anna', de: 'Auch gut!', en: 'Good too!' },
  ],
  key_phrases: [],
  notes: [],
}

function setup() {
  const fetchMock = vi.fn(async (url: string) => {
    if (url.endsWith('/api/conversations/a1-test')) return new Response(JSON.stringify(CONV), { status: 200 })
    return new Response('{}', { status: 200 })
  })
  vi.stubGlobal('fetch', fetchMock)
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/talk/a1-test']}>
        <Routes>
          <Route path="/talk/:slug" element={<ConversationPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('ConversationPage roleplay', () => {
  it('hides the learner line until it has been said, then logs practice', async () => {
    const fetchMock = setup()
    await screen.findByText('Testgespräch')
    fireEvent.click(screen.getByRole('tab', { name: 'Roleplay' }))

    expect(screen.getByText('Hallo! Wie geht’s?')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.queryByText('Gut, danke. Und dir?')).not.toBeInTheDocument()
    expect(screen.getByText('Your turn. Say your line aloud.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'I said it, show me' }))
    expect(screen.getByText('Gut, danke. Und dir?')).toBeInTheDocument()
    expect(screen.getByText('Super, danke!')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Some help' }))
    await screen.findByText(/Saved/)
    const call = fetchMock.mock.calls.find(([u]) => String(u).includes('/practice'))
    expect(call).toBeTruthy()
    expect(JSON.parse(String((call as unknown as [string, RequestInit])[1].body))).toMatchObject({ mode: 'roleplay', result: 'helped' })
  })

  it('shows English cues for learner lines in Your words mode', async () => {
    setup()
    await screen.findByText('Testgespräch')
    fireEvent.click(screen.getByRole('tab', { name: 'Your words' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Say: “Good, thanks. And you?”')).toBeInTheDocument()
  })
})
