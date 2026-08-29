/** 存储空间不足：已写入内容不丢失，需要用户清理旧卦例后再试 */
export class StorageFullError extends Error {
  constructor(message = '存储空间不足，请清理旧卦例后重试') {
    super(message)
    this.name = 'StorageFullError'
  }
}

/** 将底层存储异常转换为可展示的应用错误，其他错误原样返回 */
export function toStorageError(error: unknown): unknown {
  if (error instanceof Error && error.name === 'QuotaExceededError') {
    return new StorageFullError()
  }
  return error
}
