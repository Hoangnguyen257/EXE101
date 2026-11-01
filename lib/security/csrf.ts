/**
 * Xác thực nguồn gốc request (Origin & Referer) chống tấn công Cross-Site Request Forgery (CSRF)
 */
export function validateCsrf(req: Request): { valid: boolean; error?: string } {
  // Safe HTTP methods không yêu cầu CSRF validation
  const safeMethods = ['GET', 'HEAD', 'OPTIONS']
  if (safeMethods.includes(req.method.toUpperCase())) {
    return { valid: true }
  }

  const origin = req.headers.get('origin')
  const referer = req.headers.get('referer')
  const host = req.headers.get('host')

  // Bỏ qua nếu có custom header từ client SPA/fetch/axios
  const customHeader = req.headers.get('x-requested-with') || req.headers.get('x-csrf-protection')
  if (customHeader) {
    return { valid: true }
  }

  // Nếu thiếu cả origin lẫn referer trong mutating request
  if (!origin && !referer) {
    if (process.env.NODE_ENV !== 'production') {
      return { valid: true }
    }
    return { valid: false, error: 'Thiếu tiêu đề Origin hoặc Referer trong yêu cầu thay đổi dữ liệu.' }
  }

  const allowedHost = host || 'localhost:3000'

  if (origin) {
    try {
      const originUrl = new URL(origin)
      if (originUrl.host !== allowedHost) {
        return { valid: false, error: `Origin ${originUrl.host} không khớp với host ${allowedHost}.` }
      }
    } catch {
      return { valid: false, error: 'Origin header không hợp lệ.' }
    }
  } else if (referer) {
    try {
      const refererUrl = new URL(referer)
      if (refererUrl.host !== allowedHost) {
        return { valid: false, error: `Referer ${refererUrl.host} không khớp với host ${allowedHost}.` }
      }
    } catch {
      return { valid: false, error: 'Referer header không hợp lệ.' }
    }
  }

  return { valid: true }
}

export async function verifyCsrfOrigin(req: Request): Promise<{ valid: boolean; reason?: string }> {
  const result = validateCsrf(req)
  return { valid: result.valid, reason: result.error }
}
