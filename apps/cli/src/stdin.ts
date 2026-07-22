export async function readStdin(
  stream: NodeJS.ReadableStream = process.stdin,
): Promise<string> {
  const chunks: string[] = []

  for await (const chunk of stream) {
    chunks.push(
      typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'),
    )
  }

  return chunks.join('')
}
