import type { ContentDNA, ContentDNAPatch, SourceCreatedResponse, SourceRecord } from '../../types/content'
import type { Structure, Transformation } from '../../types/transformation'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response
  try {
    const headers = options?.body instanceof FormData ? options.headers : { 'Content-Type': 'application/json', ...options?.headers }
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    })
  } catch {
    throw new Error('Network unavailable. Check that the backend is running.')
  }

  if (!response.ok) {
    let detail = 'The request could not be completed.'
    try {
      const body = await response.json()
      detail = body.detail || detail
    } catch {
      // Keep a safe generic message for non-JSON failures.
    }
    throw new Error(detail)
  }
  return response.json() as Promise<T>
}

export function createTextSource(title: string, text: string) {
  return request<SourceCreatedResponse>('/api/v1/sources/text', {
    method: 'POST',
    body: JSON.stringify({ title, text }),
  })
}

export function createFileSource(file: File) {
  const body = new FormData()
  body.append('file', file)
  return request<SourceCreatedResponse>('/api/v1/sources/file', {
    method: 'POST',
    headers: {},
    body,
  })
}

export function getSource(sourceId: string) {
  return request<SourceRecord>(`/api/v1/sources/${sourceId}`)
}

export function patchContentDNA(sourceId: string, changes: ContentDNAPatch) {
  return request<ContentDNA>(`/api/v1/sources/${sourceId}/content-dna`, {
    method: 'PATCH',
    body: JSON.stringify(changes),
  })
}

export function listTransformations() {
  return request<{ transformations: Transformation[] }>('/api/v1/transformations')
}

export function createTransformation(title = 'Untitled Transformation') {
  return request<Transformation>('/api/v1/transformations', {
    method: 'POST',
    body: JSON.stringify({ title }),
  })
}

export function getTransformation(transformationId: string) {
  return request<Transformation>(`/api/v1/transformations/${transformationId}`)
}

export function renameTransformation(transformationId: string, title: string) {
  return request<Transformation>(`/api/v1/transformations/${transformationId}/title`, {
    method: 'PATCH',
    body: JSON.stringify({ title }),
  })
}

export function addTextSource(transformationId: string, title: string, text: string) {
  return request<Transformation>(`/api/v1/transformations/${transformationId}/sources/text`, {
    method: 'POST',
    body: JSON.stringify({ title, text }),
  })
}

export function addFileSource(transformationId: string, file: File) {
  const body = new FormData()
  body.append('file', file)
  return request<Transformation>(`/api/v1/transformations/${transformationId}/sources/file`, {
    method: 'POST',
    headers: {},
    body,
  })
}

export function addUrlSource(transformationId: string, url: string, title: string) {
  return request<Transformation>(`/api/v1/transformations/${transformationId}/sources/url`, {
    method: 'POST',
    body: JSON.stringify({ url, title }),
  })
}

export function addUnsupportedSource(transformationId: string, source_type: string, title: string, note = '') {
  return request<Transformation>(`/api/v1/transformations/${transformationId}/sources/unsupported`, {
    method: 'POST',
    body: JSON.stringify({ source_type, title, note }),
  })
}

export function removeTransformationSource(transformationId: string, sourceId: string) {
  return request<Transformation>(`/api/v1/transformations/${transformationId}/sources/${sourceId}`, {
    method: 'DELETE',
  })
}

export function patchTransformationDNA(transformationId: string, changes: ContentDNAPatch) {
  return request<Transformation>(`/api/v1/transformations/${transformationId}/content-dna`, {
    method: 'PATCH',
    body: JSON.stringify(changes),
  })
}

export function createTransformationStructure(
  transformationId: string,
  payload: { name: string; type?: string; sections: { name: string; description: string; order: number }[] },
) {
  return request<Transformation>(`/api/v1/transformations/${transformationId}/structures`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function createReferenceStructure(
  transformationId: string,
  payload: { name: string; reference_source_id: string },
) {
  return request<Transformation>(`/api/v1/transformations/${transformationId}/structures/reference`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export type GenerationConfig = {
  audience: string
  tone: string
  language: string
  detail: string
  objective: string
  style: string
}

export function generateTransformationOutputs(
  transformationId: string,
  types: string[],
  generationConfig: GenerationConfig,
  structureIds: string[] = [],
) {
  return request<Transformation>(
    `/api/v1/transformations/${transformationId}/outputs`,
    {
      method: 'POST',
      body: JSON.stringify({
        types,
        structure_ids: structureIds,
        generation_config: generationConfig,
      }),
    },
  )
}

export function restoreTransformationVersion(transformationId: string, version: number) {
  return request<Transformation>(`/api/v1/transformations/${transformationId}/versions/${version}/restore`, {
    method: 'POST',
  })
}
