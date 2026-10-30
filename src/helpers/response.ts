export type ResponseMeta = {
  page?: number;
  limit?: number;
  total?: number;
  summary?: {
    totalSms: number;
    sent: number;
    failed: number;
    pending: number;
  };
};

export type ErrorPayload = {
  code: string;
  message: string;
  details: string[];
};

export const successResponse = <T>(data: T, meta: ResponseMeta = {}) => ({
  success: true,
  data,
  meta
});

export const errorResponse = (
  code: string,
  message: string,
  details: string[] = []
) => ({
  success: false,
  error: {
    code,
    message,
    details
  }
});
