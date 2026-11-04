import { apiClient } from './client'

export type EggEventType = 'received' | 'sold' | 'cracked'

export interface EggEvent {
  id: number
  user_id: number
  user_name?: string | null
  type: EggEventType
  eggs: number
  amount?: string | number | null
  is_borrowed?: boolean
  paid?: boolean
  paid_by?: number | null
  paid_at?: string | null
  note?: string | null
  occurred_at: string
  business_date: string
  voided: boolean
  voided_by?: number | null
  voided_at?: string | null
  idempotency_key?: string | null
  created_at: string
}

export interface CreateEventPayload {
  type: EggEventType
  eggs?: number
  crates?: number
  price_per_crate?: number
  price_per_egg?: number
  amount?: number | null
  is_borrowed?: boolean
  note?: string
}

export interface UpdateEventPayload {
  eggs?: number
  crates?: number
  price_per_crate?: number
  price_per_egg?: number
  amount?: number | null
  is_borrowed?: boolean
  note?: string
}

export interface GetEventsParams {
  date?: string
  user_id?: number
  type?: EggEventType | ''
  borrowed?: boolean
  paid?: boolean
}

export const eventsApi = {
  getEvents: (params?: GetEventsParams) => {
    const query: Record<string, string | number | boolean> = {}
    if (params?.date) query.date = params.date
    if (params?.user_id) query.user_id = params.user_id
    if (params?.type) query.type = params.type
    if (params?.borrowed !== undefined) query.borrowed = params.borrowed
    if (params?.paid !== undefined) query.paid = params.paid
    return apiClient.get<EggEvent[]>('/events', { params: query }).then((r) => r.data)
  },

  createEvent: (payload: CreateEventPayload, idempotencyKey?: string) =>
    apiClient
      .post<EggEvent>('/events', payload, {
        headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
      })
      .then((r) => r.data),

  updateEvent: (id: number, payload: UpdateEventPayload) =>
    apiClient.patch<EggEvent>(`/events/${id}`, payload).then((r) => r.data),

  markPaid: (id: number) =>
    apiClient.post<EggEvent>(`/events/${id}/pay`).then((r) => r.data),

  voidEvent: (id: number) =>
    apiClient.post<EggEvent>(`/events/${id}/void`).then((r) => r.data),
}

