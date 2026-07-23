import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export const MAX_SNAPSHOT_BYTES = 256 * 1024 * 1024

export class SnapshotTooLargeError extends Error {}
export class SnapshotExtractError extends Error {}

export interface Snapshot {
  dir: string
  cleanup(): Promise<void>
}

export interface ExtractOptions {
  maxBytes?: number
}

export async function extractSnapshot(
  bytes: Uint8Array,
  options: ExtractOptions = {},
): Promise<Snapshot> {
  const maxBytes = options.maxBytes ?? MAX_SNAPSHOT_BYTES
  if (bytes.byteLength > maxBytes) {
    throw new SnapshotTooLargeError(
      `snapshot is ${bytes.byteLength} bytes, over the ${maxBytes} byte limit`,
    )
  }

  const root = await mkdtemp(join(tmpdir(), 'exocortex-snapshot-'))
  const cleanup = () => rm(root, { recursive: true, force: true })

  try {
    const repo = join(root, 'repo')
    const archive = join(root, 'snapshot.tgz')
    await mkdir(repo)
    await writeFile(archive, bytes)
    // --no-same-owner: extract as the container user so the restored .git is
    // owned by us, not the client's uid. Otherwise git rejects the repo with
    // "detected dubious ownership".
    await execFileAsync('tar', ['xzf', archive, '-C', repo, '--no-same-owner'])
    return { dir: repo, cleanup }
  } catch (cause) {
    await cleanup()
    throw new SnapshotExtractError('failed to extract snapshot', { cause })
  }
}
