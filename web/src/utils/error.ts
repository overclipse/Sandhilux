import type { AxiosError } from 'axios'

export function getErrorMessage(err: unknown): string {
  const axiosErr = err as AxiosError<{ error?: string }>
  if (axiosErr.response?.data?.error) {
    return axiosErr.response.data.error
  }
  if (axiosErr.message) {
    if (axiosErr.code === 'ERR_NETWORK') return 'Backend is unreachable. Check that the server is running.'
    return axiosErr.message
  }
  return 'Something went wrong'
}
