# adjudication worksheet

コメントの出所は伏せてあります。
対応表は `adjudication-key.json` にあります。採点を終えるまで開かないでください。

各コメントについて、`判定` の該当する語だけを残してください。

## clean-bugfix-05

### 00a8f551c8

- 位置: `src/metrics/latency.ts:8`
- severity: minor

```
return ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2
```

The 'as number' type assertions are redundant since sorted is a number[] and the elements are guaranteed to be numbers.

判定: true positive / false positive / 判断不能
メモ:

### 046d078925

- 位置: `src/metrics/latency.ts:8`
- severity: minor

```
return ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2
```

The 'as number' type assertions are unnecessary here for the same reason as line 6.

判定: true positive / false positive / 判断不能
メモ:

### 0cd9811267

- 位置: `src/metrics/latency.test.ts:13`
- severity: minor

```
  it('orders samples numerically rather than lexicographically', () => {
```

Duplicate test definition; identical test already exists at lines 17-19.

判定: true positive / false positive / 判断不能
メモ:

### 25691a7bf4

- 位置: `src/metrics/latency.ts:8`
- severity: minor

```
return ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2
```

The 'as number' type assertions are redundant since sorted is a number[] and the elements are guaranteed to be numbers.

判定: true positive / false positive / 判断不能
メモ:

### 3d29449084

- 位置: `src/metrics/latency.test.ts:21`
- severity: minor

```
  it('leaves the array the caller passed in untouched', () => {
```

Duplicate test definition; identical test already exists at lines 21-25.

判定: true positive / false positive / 判断不能
メモ:

### 4693f7e9bf

- 位置: `src/metrics/latency.ts:8`
- severity: minor

```
return ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2
```

The 'as number' type assertions are redundant since sorted is a number[] and the elements are guaranteed to be numbers.

判定: true positive / false positive / 判断不能
メモ:

### 493b6eb036

- 位置: `src/metrics/latency.test.ts:21`
- severity: minor

```
  it('leaves the array the caller passed in untouched', () => {
```

Duplicate test definition; identical test already exists at lines 21-25.

判定: true positive / false positive / 判断不能
メモ:

### 4a999ee8f4

- 位置: `src/metrics/latency.ts:6`
- severity: minor

```
if (sorted.length % 2 === 1) return sorted[middle] as number
```

The 'as number' type assertion is unnecessary because the array is explicitly typed as number[] and index access on a non-empty array of numbers results in a number.

判定: true positive / false positive / 判断不能
メモ:

### 57f35ba7b3

- 位置: `src/metrics/latency.ts:8`
- severity: minor

```
(sorted[middle - 1] as number) + (sorted[middle] as number)) / 2
```

The `as number` casts are redundant for the same reason. Removing them improves code clarity.

判定: true positive / false positive / 判断不能
メモ:

### 659548a453

- 位置: `src/metrics/latency.ts:6`
- severity: minor

```
if (sorted.length % 2 === 1) return sorted[middle] as number
```

The 'as number' type assertion is unnecessary because the array is explicitly typed as number[] and index access on a non-empty array of numbers results in a number.

判定: true positive / false positive / 判断不能
メモ:

### 68b32a42ca

- 位置: `src/metrics/latency.ts:6`
- severity: minor

```
return sorted[middle] as number
```

The `as number` cast is redundant because the input type guarantees elements are numbers and array access returns a valid value when length > 0. Removing it improves code clarity.

判定: true positive / false positive / 判断不能
メモ:

### 6a812134f0

- 位置: `src/metrics/latency.test.ts:13`
- severity: minor

```
  it('orders samples numerically rather than lexicographically', () => {
```

Duplicate test definition; identical test already exists at lines 17-19.

判定: true positive / false positive / 判断不能
メモ:

### 8b8793aa8d

- 位置: `src/metrics/latency.ts:8`
- severity: minor

```
(sorted[middle - 1] as number) + (sorted[middle] as number)) / 2
```

The `as number` casts are redundant for the same reason. Removing them improves code clarity.

判定: true positive / false positive / 判断不能
メモ:

### 8d2679da77

- 位置: `src/metrics/latency.ts:6`
- severity: minor

```
return sorted[middle] as number
```

The `as number` cast is redundant because the input type guarantees elements are numbers and array access returns a valid value when length > 0. Removing it improves code clarity.

判定: true positive / false positive / 判断不能
メモ:

### 9aa6fbee2f

- 位置: `src/metrics/latency.ts:6`
- severity: minor

```
if (sorted.length % 2 === 1) return sorted[middle] as number
```

The 'as number' type assertion is unnecessary because the array is explicitly typed as number[] and index access on a non-empty array of numbers results in a number.

判定: true positive / false positive / 判断不能
メモ:

### 9ff3f14090

- 位置: `src/metrics/latency.test.ts:13`
- severity: minor

```
  it('orders samples numerically rather than lexicographically', () => {
```

Duplicate test definition; identical test already exists at lines 17-19.

判定: true positive / false positive / 判断不能
メモ:

### a938fdfc5b

- 位置: `src/metrics/latency.test.ts:21`
- severity: minor

```
  it('leaves the array the caller passed in untouched', () => {
```

Duplicate test definition; identical test already exists at lines 21-25.

判定: true positive / false positive / 判断不能
メモ:

### ab0072b928

- 位置: `src/metrics/latency.ts:8`
- severity: minor

```
(sorted[middle - 1] as number) + (sorted[middle] as number)) / 2
```

The `as number` casts are redundant for the same reason. Removing them improves code clarity.

判定: true positive / false positive / 判断不能
メモ:

### ac582b4d82

- 位置: `src/metrics/latency.ts:8`
- severity: minor

```
return ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2
```

The 'as number' type assertions are unnecessary here for the same reason as line 6.

判定: true positive / false positive / 判断不能
メモ:

### b6d149cf89

- 位置: `src/metrics/latency.ts:8`
- severity: minor

```
return ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2
```

Redundant 'as number' type assertions are unnecessary since the elements in 'sorted' are already of type number.

判定: true positive / false positive / 判断不能
メモ:

### bdd5e92d4c

- 位置: `src/metrics/latency.ts:8`
- severity: minor

```
return ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2
```

The 'as number' type assertions are unnecessary here for the same reason as line 6.

判定: true positive / false positive / 判断不能
メモ:

### be90171ffb

- 位置: `src/metrics/latency.ts:8`
- severity: minor

```
return ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2
```

Redundant 'as number' type assertions are unnecessary since the elements in 'sorted' are already of type number.

判定: true positive / false positive / 判断不能
メモ:

### dcf3325f1b

- 位置: `src/metrics/latency.ts:8`
- severity: minor

```
return ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2
```

Redundant 'as number' type assertions are unnecessary since the elements in 'sorted' are already of type number.

判定: true positive / false positive / 判断不能
メモ:

### f0ffe3d20b

- 位置: `src/metrics/latency.ts:6`
- severity: minor

```
return sorted[middle] as number
```

The `as number` cast is redundant because the input type guarantees elements are numbers and array access returns a valid value when length > 0. Removing it improves code clarity.

判定: true positive / false positive / 判断不能
メモ:

## clean-dependency-update-06

### 0ad22c8306

- 位置: `src/avatars/fetchAvatar.ts:17`
- severity: major

```
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
```

AbortSignal.timeout() is not supported in all Node.js environments. In older versions or certain contexts, this will throw TypeError instead of gracefully handling timeout.

判定: true positive / false positive / 判断不能
メモ:

### 0d2a65ad57

- 位置: `src/avatars/fetchAvatar.ts:16`
- severity: critical

```
    size: MAX_AVATAR_BYTES,
```

The 'fetch' API (and node-fetch) does not support a 'size' property in the options object to limit response size. This will be ignored by the fetch implementation.

判定: true positive / false positive / 判断不能
メモ:

### 1271884c2e

- 位置: `src/avatars/fetchAvatar.ts:16`
- severity: critical

```
    size: MAX_AVATAR_BYTES,
```

node-fetch v3 does not support the 'size' option on fetch(). This property was deprecated in node-fetch and removed. The response body will be fully downloaded regardless of this setting, potentially causing memory issues for large responses.

判定: true positive / false positive / 判断不能
メモ:

### 145c3aac28

- 位置: `src/avatars/fetchAvatar.ts:25`
- severity: critical

```
    bytes: Buffer.from(await response.arrayBuffer()),
```

response.arrayBuffer() can throw errors (network failures) that are not caught. If the fetch fails, this line will cause an unhandled promise rejection instead of a proper error being thrown.

判定: true positive / false positive / 判断不能
メモ:

### 21b4ae0a4a

- 位置: `src/avatars/fetchAvatar.ts:16`
- severity: critical

```
    size: MAX_AVATAR_BYTES,
```

node-fetch v3 does not support the 'size' option on fetch(). This property was deprecated in node-fetch and removed. The response body will be fully downloaded regardless of this setting, potentially causing memory issues for large responses.

判定: true positive / false positive / 判断不能
メモ:

### 737f522751

- 位置: `src/avatars/fetchAvatar.ts:25`
- severity: critical

```
    bytes: Buffer.from(await response.arrayBuffer()),
```

response.arrayBuffer() can throw errors (network failures) that are not caught. If the fetch fails, this line will cause an unhandled promise rejection instead of a proper error being thrown.

判定: true positive / false positive / 判断不能
メモ:

### 8c4b437050

- 位置: `src/avatars/fetchAvatar.ts:16`
- severity: critical

```
    size: MAX_AVATAR_BYTES,
```

The 'fetch' API (and node-fetch) does not support a 'size' property in the options object to limit response size. This will be ignored by the fetch implementation.

判定: true positive / false positive / 判断不能
メモ:

### a1a2b13bbf

- 位置: `src/avatars/fetchAvatar.ts:25`
- severity: minor

```
bytes: Buffer.from(await response.arrayBuffer()),
```

Using response.arrayBuffer() and converting to Buffer is redundant. node-fetch v3's response.buffer() directly returns a Buffer, which is more efficient and idiomatic.

判定: true positive / false positive / 判断不能
メモ:

### b0270643d3

- 位置: `package.json:5`
- severity: info

```
  "type": "module",
```

With node-fetch v3 being ESM-only and the project using type: module, ensure all dependencies are also compatible with ES modules. Some packages may still use CommonJS which could cause issues.

判定: true positive / false positive / 判断不能
メモ:

### b79595c7ca

- 位置: `src/avatars/fetchAvatar.ts:16`
- severity: critical

```
    size: MAX_AVATAR_BYTES,
```

The 'fetch' API (and node-fetch) does not support a 'size' property in the options object to limit response size. This will be ignored by the fetch implementation.

判定: true positive / false positive / 判断不能
メモ:

### ce64ad9281

- 位置: `package.json:5`
- severity: info

```
  "type": "module",
```

With node-fetch v3 being ESM-only and the project using type: module, ensure all dependencies are also compatible with ES modules. Some packages may still use CommonJS which could cause issues.

判定: true positive / false positive / 判断不能
メモ:

### de7a2a3c99

- 位置: `src/avatars/fetchAvatar.ts:17`
- severity: major

```
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
```

AbortSignal.timeout() is not supported in all Node.js environments. In older versions or certain contexts, this will throw TypeError instead of gracefully handling timeout.

判定: true positive / false positive / 判断不能
メモ:

### e103d5a4b4

- 位置: `src/avatars/fetchAvatar.ts:16`
- severity: critical

```
    size: MAX_AVATAR_BYTES,
```

node-fetch v3 does not support the 'size' option on fetch(). This property was deprecated in node-fetch and removed. The response body will be fully downloaded regardless of this setting, potentially causing memory issues for large responses.

判定: true positive / false positive / 判断不能
メモ:

### f0114602c0

- 位置: `src/avatars/fetchAvatar.ts:25`
- severity: critical

```
    bytes: Buffer.from(await response.arrayBuffer()),
```

response.arrayBuffer() can throw errors (network failures) that are not caught. If the fetch fails, this line will cause an unhandled promise rejection instead of a proper error being thrown.

判定: true positive / false positive / 判断不能
メモ:

### f12ab3a788

- 位置: `package.json:5`
- severity: info

```
  "type": "module",
```

With node-fetch v3 being ESM-only and the project using type: module, ensure all dependencies are also compatible with ES modules. Some packages may still use CommonJS which could cause issues.

判定: true positive / false positive / 判断不能
メモ:

### f30f0b64cb

- 位置: `src/avatars/fetchAvatar.ts:25`
- severity: minor

```
bytes: Buffer.from(await response.arrayBuffer()),
```

Using response.arrayBuffer() and converting to Buffer is redundant. node-fetch v3's response.buffer() directly returns a Buffer, which is more efficient and idiomatic.

判定: true positive / false positive / 判断不能
メモ:

### f37b985ca0

- 位置: `src/avatars/fetchAvatar.ts:17`
- severity: major

```
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
```

AbortSignal.timeout() is not supported in all Node.js environments. In older versions or certain contexts, this will throw TypeError instead of gracefully handling timeout.

判定: true positive / false positive / 判断不能
メモ:

## clean-refactor-01

### 07997e7503

- 位置: `src/report.ts:11`
- severity: minor

```
  return rows.map(formatRow).join('')
```

Using .map().join('') creates an intermediate array of strings before joining. For very large datasets, the original loop-based concatenation (or a single pass) is more memory efficient.

判定: true positive / false positive / 判断不能
メモ:

### 1fdcea12e1

- 位置: `src/report.ts:6`
- severity: critical

```
function formatRow(row: Row): string {
```

The diff adds a second definition of `formatRow` after the interface, resulting in two identical function declarations. This causes a compile-time error due to duplicate identifier.

判定: true positive / false positive / 判断不能
メモ:

### 28b11bba82

- 位置: `src/report.ts:6`
- severity: critical

```
function formatRow(row: Row): string {
```

The diff adds a second definition of `formatRow` after the interface, resulting in two identical function declarations. This causes a compile-time error due to duplicate identifier.

判定: true positive / false positive / 判断不能
メモ:

### 67c1a08e1d

- 位置: `src/report.ts:11`
- severity: minor

```
  return rows.map(formatRow).join('')
```

Using .map().join('') creates an intermediate array of strings before joining. For very large datasets, the original loop-based concatenation (or a single pass) is more memory efficient.

判定: true positive / false positive / 判断不能
メモ:

### 6859333903

- 位置: `src/report.ts:11`
- severity: minor

```
  return rows.map(formatRow).join('')
```

Using .map().join('') creates an intermediate array of strings before joining. For very large datasets, the original loop-based concatenation (or a single pass) is more memory efficient.

判定: true positive / false positive / 判断不能
メモ:

### a68db58458

- 位置: `src/report.ts:6`
- severity: critical

```
function formatRow(row: Row): string {
```

The diff adds a new function named `formatRow` without removing the existing one, resulting in a duplicate identifier and preventing the file from compiling.

判定: true positive / false positive / 判断不能
メモ:

## clean-rename-02

コメントはありません。

## clean-tests-added-03

### 0ac0d69b1b

- 位置: `src/text/slug.test.ts:13`
- severity: major

```
expect(slugify('  Draft - Q3 Report  ')).toBe('draft-q3-report')
```

The test expects 'draft-q3-report' as output, but the current implementation would produce 'draft---q3---report' due to the incorrect regex pattern in slug.ts. This test is invalid under the current code logic.

判定: true positive / false positive / 判断不能
メモ:

### 2ee80730d2

- 位置: `src/text/slug.ts:4`
- severity: critical

```
replace(/[^a-z0-9]+/g, '-')
```

The regex incorrectly replaces hyphens (which are valid in slugs) with hyphens, and collapses all non-alphanumeric characters (including hyphens) into single hyphens. This causes unexpected behavior when processing inputs with hyphens and other non-alphanumeric characters.

判定: true positive / false positive / 判断不能
メモ:

### 37b254d8a0

- 位置: `src/text/slug.test.ts:13`
- severity: critical

```
  it('drops leading and trailing separators', () => {
    expect(slugify('  Draft - Q3 Report  ')).toBe('draft-q3-report')
  })
```

This test case is already present in the original code. Adding it again creates a duplicate test, which is redundant and may cause confusion during test execution.

判定: true positive / false positive / 判断不能
メモ:

### 5b5a0da78f

- 位置: `src/text/slug.ts:4`
- severity: major

```
    .replace(/[^a-z0-9]+/g, '-')
```

The regex replaces a sequence of non-alphanumeric characters with a single hyphen, but if the input contains spaces and punctuation together (e.g., 'word1  --  word2'), this logic works; however, it doesn't account for cases where multiple different types of separators might be adjacent in ways that could result in double hyphens if the regex was slightly different. More importantly, while this specific implementation handles runs of non-alphanumeric characters correctly by replacing them with a single hyphen, the test suite is missing a case to verify that internal consecutive hyphens are collapsed.

判定: true positive / false positive / 判断不能
メモ:

### 6d4de3edc2

- 位置: `src/text/slug.ts:4`
- severity: major

```
    .replace(/[^a-z0-9]+/g, '-')
```

The regex replaces a sequence of non-alphanumeric characters with a single hyphen, but if the input contains spaces and punctuation together (e.g., 'word1  --  word2'), this logic works; however, it doesn't account for cases where multiple different types of separators might be adjacent in ways that could result in double hyphens if the regex was slightly different. More importantly, while this specific implementation handles runs of non-alphanumeric characters correctly by replacing them with a single hyphen, the test suite is missing a case to verify that internal consecutive hyphens are collapsed.

判定: true positive / false positive / 判断不能
メモ:

### 6efa2ff483

- 位置: `src/text/slug.test.ts:13`
- severity: major

```
expect(slugify('  Draft - Q3 Report  ')).toBe('draft-q3-report')
```

The test expects 'draft-q3-report' as output, but the current implementation would produce 'draft---q3---report' due to the incorrect regex handling of hyphens and spaces. The test is invalid under the current code logic.

判定: true positive / false positive / 判断不能
メモ:

### 9e1df6d727

- 位置: `src/text/slug.ts:4`
- severity: critical

```
replace(/[^a-z0-9]+/g, '-')
```

The regex incorrectly replaces hyphens (which are valid in slugs) with hyphens, and collapses runs of non-alphanumeric characters (including hyphens) into single hyphens. This causes unexpected behavior when processing inputs with hyphens and other non-alphanumeric characters.

判定: true positive / false positive / 判断不能
メモ:

### ac5785288b

- 位置: `src/text/slug.test.ts:13`
- severity: critical

```
  it('drops leading and trailing separators', () => {
    expect(slugify('  Draft - Q3 Report  ')).toBe('draft-q3-report')
  })
```

This test case is already present in the original code. Adding it again creates a duplicate test, which is redundant and may cause confusion during test execution.

判定: true positive / false positive / 判断不能
メモ:

### fbde8a68fc

- 位置: `src/text/slug.ts:4`
- severity: major

```
    .replace(/[^a-z0-9]+/g, '-')
```

The regex replaces a sequence of non-alphanumeric characters with a single hyphen, but if the input contains spaces and punctuation together (e.g., 'word1  --  word2'), this logic works; however, it doesn't account for cases where multiple different types of separators might be adjacent in ways that could result in double hyphens if the regex was slightly different. More importantly, while this specific implementation handles runs of non-alphanumeric characters correctly by replacing them with a single hyphen, the test suite is missing a case to verify that internal consecutive hyphens are collapsed.

判定: true positive / false positive / 判断不能
メモ:

## clean-type-annotations-04

### 08f0bbaf25

- 位置: `src/http/pagination.ts:4`
- severity: critical

```
export function clampPageSize(requested: number): number {
```

The diff attempts to add a return type annotation to 'clampPageSize', but the original file already declares this function with a return type. Adding it again will produce duplicate function signatures.

判定: true positive / false positive / 判断不能
メモ:

### 0dbf338448

- 位置: `src/http/catalog.ts:8`
- severity: critical

```
export interface ProductPage {
```

Duplicate definition of 'ProductPage' interface. The file already defines this interface at lines 8-12, so adding another identical definition will cause a compile error.

判定: true positive / false positive / 判断不能
メモ:

### 25e93678d3

- 位置: `src/http/catalog.ts:8`
- severity: critical

```
export interface ProductPage {
```

Duplicate definition of 'ProductPage' interface. The file already defines this interface at lines 8-12, so adding another identical definition will cause a compile error.

判定: true positive / false positive / 判断不能
メモ:

### 57a9dcc7a8

- 位置: `src/http/pagination.ts:4`
- severity: critical

```
export function clampPageSize(requested: number): number {
```

The diff attempts to add a return type annotation to 'clampPageSize', but the original file already declares this function with a return type. Adding it again will produce duplicate function signatures.

判定: true positive / false positive / 判断不能
メモ:

### 84379538f4

- 位置: `src/http/pagination.ts:9`
- severity: critical

```
export function toOffset(page: number, pageSize: number): number {
```

Similarly, adding a return type annotation to 'toOffset' duplicates the existing signature.

判定: true positive / false positive / 判断不能
メモ:

### 8fdaa56722

- 位置: `src/http/pagination.ts:9`
- severity: critical

```
export function toOffset(page: number, pageSize: number): number {
```

Similarly, adding a return type annotation to 'toOffset' duplicates the existing signature.

判定: true positive / false positive / 判断不能
メモ:

### b202911ba2

- 位置: `src/http/catalog.ts:8`
- severity: critical

```
export interface ProductPage {
```

Duplicate definition of 'ProductPage' interface. The file already defines this interface at lines 8-12, so adding another identical definition will cause a compile error.

判定: true positive / false positive / 判断不能
メモ:

### cf3fb12c9e

- 位置: `src/http/catalog.ts:25`
- severity: critical

```
total: products.length,
```

The 'total' field is incorrectly calculated as the length of the current 'products' array, which may not represent the actual total number of products available. This will lead to incorrect pagination metadata when 'products' is a subset of all products.

判定: true positive / false positive / 判断不能
メモ:

### dcc43cf6c6

- 位置: `src/http/pagination.ts:4`
- severity: critical

```
export function clampPageSize(requested: number): number {
```

The diff attempts to add a return type annotation to 'clampPageSize', but the original file already declares this function with a return type. Adding it again will produce duplicate function signatures.

判定: true positive / false positive / 判断不能
メモ:

### f0e66db7d4

- 位置: `src/http/pagination.ts:9`
- severity: critical

```
export function toOffset(page: number, pageSize: number): number {
```

Similarly, adding a return type annotation to 'toOffset' duplicates the existing signature.

判定: true positive / false positive / 判断不能
メモ:

### f904d2e9e9

- 位置: `src/http/catalog.ts:8`
- severity: minor

```
export interface ProductPage {
```

The 'ProductPage' interface is declared twice in the file. This is redundant and may cause confusion or errors if the interfaces are not identical.

判定: true positive / false positive / 判断不能
メモ:

## concurrency-floating-promise-02

### 161cfe80ef

- 位置: `src/replay.ts:18`
- severity: major

```
events.forEach(async (event) => {
```

Using forEach with an async callback does not wait for promises to resolve. All handlers execute concurrently without sequencing, and the function returns before any handler completes its work. This breaks event ordering guarantees and can cause race conditions if readModel.publish has side effects.

判定: true positive / false positive / 判断不能
メモ:

### 17cff07fb9

- 位置: `src/replay.ts:18`
- severity: major

```
events.forEach(async (event) => {
```

Using Array.forEach with an async callback does not wait for the promises to resolve. The replay function returns before all handlers have finished, leading to incomplete processing and potentially missing updates in the read model.

判定: true positive / false positive / 判断不能
メモ:

### 18d0fdbd59

- 位置: `src/replay.ts:18`
- severity: critical

```
events.forEach(async (event) => {
```

Using forEach with async functions without awaiting them will cause the loop to complete before all handlers have finished executing, leading to potential race conditions and incomplete processing.

判定: true positive / false positive / 判断不能
メモ:

### 2214807f9c

- 位置: `src/replay.ts:18`
- severity: major

```
events.forEach(async (event) => {
```

Using forEach with an async callback does not wait for promises to resolve. All handlers execute concurrently without sequencing, and the function returns before any handler completes its work. This breaks event ordering guarantees and can cause race conditions if readModel.publish has side effects.

判定: true positive / false positive / 判断不能
メモ:

### 279b0acd46

- 位置: `src/handlers.ts:20`
- severity: critical

```
    bump(state.reserved, event.sku, -event.quantity)
```

Modifies the state's Map directly, leading to in-place mutation of shared state objects. This corrupts state transitions when multiple events are processed sequentially.

判定: true positive / false positive / 判断不能
メモ:

### 2f2ef93e94

- 位置: `src/replay.ts:18`
- severity: critical

```
events.forEach(async (event) => {
```

Using .forEach() with an async callback does not await the promises. The 'replay' function will return before the handlers finish executing.

判定: true positive / false positive / 判断不能
メモ:

### 48dfcc36a9

- 位置: `src/handlers.ts:16`
- severity: critical

```
    bump(state.reserved, event.sku, event.quantity)
```

Modifies the state's Map directly, leading to in-place mutation of shared state objects. This corrupts state transitions when multiple events are processed sequentially.

判定: true positive / false positive / 判断不能
メモ:

### 4af3041092

- 位置: `src/replay.ts:18`
- severity: critical

```
  events.forEach(async (event) => {
```

The `.forEach` method does not await the promises returned by its callback. This means the `replay` function will return before all handlers have finished executing, leading to a race condition where the `applied` array may be empty or incomplete when returned. Use a `for...of` loop instead.

判定: true positive / false positive / 判断不能
メモ:

### 4d28f5f394

- 位置: `src/handlers.ts:24`
- severity: critical

```
    bump(state.reserved, event.sku, -event.quantity)
```

Modifies the state's Map directly, leading to in-place mutation of shared state objects. This corrupts state transitions when multiple events are processed sequentially.

判定: true positive / false positive / 判断不能
メモ:

### 4f0f0f9e03

- 位置: `src/handlers.ts:24`
- severity: critical

```
    bump(state.reserved, event.sku, -event.quantity)
```

Modifies the state's Map directly, leading to in-place mutation of shared state objects. This corrupts state transitions when multiple events are processed sequentially.

判定: true positive / false positive / 判断不能
メモ:

### 51b196e9a7

- 位置: `src/replay.ts:25`
- severity: major

```
await handler(state, event, readModel)
```

Because the outer loop does not await each handler, this await is ineffective. Handlers may run concurrently and mutate shared state (state.onHand and state.reserved) leading to race conditions.

判定: true positive / false positive / 判断不能
メモ:

### 5ae22948c1

- 位置: `src/replay.ts:18`
- severity: major

```
events.forEach(async (event) => {
```

Using forEach with an async callback does not wait for promises to resolve. All handlers execute concurrently without sequencing, and the function returns before any handler completes its work. This breaks event ordering guarantees and can cause race conditions if readModel.publish has side effects.

判定: true positive / false positive / 判断不能
メモ:

### 66b35bcae2

- 位置: `src/replay.ts:18`
- severity: critical

```
  events.forEach(async (event) => {
```

The .forEach method does not await the promises returned by its callback. This means the replay function will return before all handlers have finished executing, leading to a race condition where the 'applied' array may be empty or incomplete when returned. Use a for...of loop instead.

判定: true positive / false positive / 判断不能
メモ:

### 7116eb12f8

- 位置: `src/replay.ts:18`
- severity: major

```
events.forEach(async (event) => {
```

Using Array.forEach with an async callback does not wait for the promises to resolve. The replay function returns before all handlers have finished, leading to incomplete processing and potentially missing updates in the read model.

判定: true positive / false positive / 判断不能
メモ:

### 71592274fc

- 位置: `src/replay.ts:18`
- severity: critical

```
  events.forEach(async (event) => {
```

The .forEach method does not await the promises returned by its callback. This means the replay function will return before all handlers have finished executing, leading to a race condition where the 'applied' array may be empty or incomplete when returned. Use a for...of loop instead.

判定: true positive / false positive / 判断不能
メモ:

### 764f169edd

- 位置: `src/replay.ts:25`
- severity: major

```
await handler(state, event, readModel)
```

Because the outer loop does not await each handler, this await is ineffective. Handlers may run concurrently and mutate shared state (state.onHand and state.reserved) leading to race conditions.

判定: true positive / false positive / 判断不能
メモ:

### 8998cc2a8e

- 位置: `src/replay.ts:18`
- severity: major

```
  events.forEach(async (event) => {
```

Using async/await inside forEach creates unhandled asynchronous operations that may not complete before the loop ends, leading to potential race conditions and incomplete event processing.

判定: true positive / false positive / 判断不能
メモ:

### 96cd8a5988

- 位置: `src/replay.ts:18`
- severity: critical

```
events.forEach(async (event) => {
```

Using forEach with async functions inside the callback will not wait for the promises to resolve. This can lead to the replay function completing before all event handlers have finished, resulting in incomplete processing of events.

判定: true positive / false positive / 判断不能
メモ:

### a444fa932a

- 位置: `src/handlers.ts:13`
- severity: major

```
await readModel.publish(snapshotOf(state, event.sku))
```

Publishing a snapshot for a specific SKU after modifying the state may not capture the full state context, depending on the read model's expectations.

判定: true positive / false positive / 判断不能
メモ:

### c158b45c15

- 位置: `src/replay.ts:18`
- severity: critical

```
events.forEach(async (event) => {
```

Using .forEach() with an async callback does not await the promises. The 'replay' function will return before the handlers finish executing.

判定: true positive / false positive / 判断不能
メモ:

### c30607f39c

- 位置: `src/handlers.ts:12`
- severity: critical

```
    bump(state.onHand, event.sku, event.quantity)
```

Modifies the state's Map directly, leading to in-place mutation of shared state objects. This corrupts state transitions when multiple events are processed sequentially.

判定: true positive / false positive / 判断不能
メモ:

### caf794c03d

- 位置: `src/handlers.ts:12`
- severity: major

```
bump(state.onHand, event.sku, event.quantity)
```

Modifying the state's maps directly in handlers may lead to unintended side effects if the state is shared or mutated elsewhere, though this is likely intended for cumulative state updates.

判定: true positive / false positive / 判断不能
メモ:

### ce45a69b37

- 位置: `src/replay.ts:18`
- severity: critical

```
events.forEach(async (event) => {
```

Using forEach with async functions inside the loop will not wait for each handler to complete, leading to potential race conditions and incorrect event processing order. Replace with a for...of loop and use await explicitly.

判定: true positive / false positive / 判断不能
メモ:

### d385fd0a24

- 位置: `src/handlers.ts:16`
- severity: critical

```
    bump(state.reserved, event.sku, event.quantity)
```

Modifies the state's Map directly, leading to in-place mutation of shared state objects. This corrupts state transitions when multiple events are processed sequentially.

判定: true positive / false positive / 判断不能
メモ:

### d924784805

- 位置: `src/replay.ts:25`
- severity: major

```
await handler(state, event, readModel)
```

Because the outer loop does not await each handler, this await is ineffective. Handlers may run concurrently and mutate shared state (state.onHand and state.reserved) leading to race conditions.

判定: true positive / false positive / 判断不能
メモ:

### db79ea3f5f

- 位置: `src/replay.ts:18`
- severity: critical

```
events.forEach(async (event) => {
```

Using forEach with async functions inside the callback will not wait for the promises to resolve. This can lead to the replay function completing before all event handlers have finished, resulting in incomplete processing of events.

判定: true positive / false positive / 判断不能
メモ:

### ded13d324e

- 位置: `src/replay.ts:18`
- severity: major

```
events.forEach(async (event) => {
```

Using Array.forEach with an async callback does not wait for the promises to resolve. The replay function returns before all handlers have finished, leading to incomplete processing and potentially missing updates in the read model.

判定: true positive / false positive / 判断不能
メモ:

### ebfbaebf82

- 位置: `src/replay.ts:18`
- severity: critical

```
events.forEach(async (event) => {
```

Using .forEach() with an async callback does not await the promises. The 'replay' function will return before the handlers finish executing.

判定: true positive / false positive / 判断不能
メモ:

### f4957ff7b8

- 位置: `src/handlers.ts:20`
- severity: critical

```
    bump(state.reserved, event.sku, -event.quantity)
```

Modifies the state's Map directly, leading to in-place mutation of shared state objects. This corrupts state transitions when multiple events are processed sequentially.

判定: true positive / false positive / 判断不能
メモ:

### f54f232efc

- 位置: `src/handlers.ts:12`
- severity: critical

```
    bump(state.onHand, event.sku, event.quantity)
```

Modifies the state's Map directly, leading to in-place mutation of shared state objects. This corrupts state transitions when multiple events are processed sequentially.

判定: true positive / false positive / 判断不能
メモ:

### fdb4775d58

- 位置: `src/replay.ts:18`
- severity: major

```
  events.forEach(async (event) => {
```

Using async/await inside forEach creates unhandled asynchronous operations that may not complete before the loop ends, leading to potential race conditions and incomplete event processing.

判定: true positive / false positive / 判断不能
メモ:

## concurrency-race-01

### 030010f27a

- 位置: `src/meter.ts:48`
- severity: critical

```
await this.store.set(key, JSON.stringify(next))
```

Replacing the atomic `incrBy` operation with a non-atomic read-modify-write sequence allows concurrent requests to overwrite each other's updates for the same tenant/month key. This results in lost usage counts and incorrect quota status under load.

判定: true positive / false positive / 判断不能
メモ:

### 0b75d9e9f8

- 位置: `src/meter.ts:47`
- severity: critical

```
    const snapshot = decodeSnapshot(await this.store.get(key))
```

Using get() followed by set() instead of incrBy() removes atomicity, allowing concurrent requests to overwrite each other's updates and leading to lost tokens.

判定: true positive / false positive / 判断不能
メモ:

### 27142815a3

- 位置: `src/meter.ts:45`
- severity: critical

```
  const snapshot = decodeSnapshot(await this.store.get(key))
```

Non‑atomic read–modify–write sequence: reading the snapshot, modifying it, and writing back can lead to lost updates when multiple concurrent calls occur. Use an atomic increment (e.g., incrBy) or a transaction to avoid race conditions.

判定: true positive / false positive / 判断不能
メモ:

### 282ce5fb9a

- 位置: `src/meter.ts:45`
- severity: critical

```
const snapshot = decodeSnapshot(await this.store.get(key))
```

This read-modify-write cycle is not atomic. Concurrent calls to `record` for the same tenant and month will result in a race condition where one update overwrites another, leading to lost usage data. The previous implementation used `incrBy`, which was likely an atomic operation.

判定: true positive / false positive / 判断不能
メモ:

### 2a200ede7c

- 位置: `src/meter.ts:47`
- severity: critical

```
const snapshot = decodeSnapshot(await this.store.get(key))
```

Using get() followed by set() for usage tracking introduces race conditions when multiple requests update the same key concurrently. This can lead to undercounted usage totals and incorrect quota status.

判定: true positive / false positive / 判断不能
メモ:

### 2cf7842560

- 位置: `src/meter.ts:23`
- severity: minor

```
  return JSON.parse(raw) as UsageSnapshot
```

JSON.parse can throw if the stored value is not valid JSON. Consider handling parse errors to avoid crashes on corrupted data.

判定: true positive / false positive / 判断不能
メモ:

### 492b6d73e5

- 位置: `src/meter.ts:48`
- severity: critical

```
await this.store.set(key, JSON.stringify(next))
```

Replacing the atomic `incrBy` operation with a non-atomic read-modify-write sequence allows concurrent requests to overwrite each other's updates for the same tenant/month key. This results in lost usage counts and incorrect quota status under load.

判定: true positive / false positive / 判断不能
メモ:

### 4a607388c6

- 位置: `src/meter.ts:48`
- severity: critical

```
await this.store.set(key, JSON.stringify(next))
```

Non-atomic write operation after reading the snapshot can overwrite concurrent updates, leading to data corruption. The original incrBy() method provided atomicity which is now missing.

判定: true positive / false positive / 判断不能
メモ:

### 4d4eab942b

- 位置: `src/meter.ts:45`
- severity: critical

```
const snapshot = decodeSnapshot(await this.store.get(key))
```

The transition from 'incrBy' to a 'get-then-set' pattern is not atomic. In a concurrent environment, two simultaneous requests will both read the same snapshot, add their respective tokens, and the last one to call 'set' will overwrite the other's contribution.

判定: true positive / false positive / 判断不能
メモ:

### 52da135f02

- 位置: `src/meter.ts:45`
- severity: critical

```
const snapshot = decodeSnapshot(await this.store.get(key))
```

This read-modify-write cycle is not atomic. Concurrent calls to `record` for the same tenant and month will result in a race condition where one update overwrites another, leading to lost usage data. The previous implementation used `incrBy`, which was likely an atomic operation.

判定: true positive / false positive / 判断不能
メモ:

### 5b3a27753f

- 位置: `src/meter.ts:23`
- severity: major

```
return JSON.parse(raw) as UsageSnapshot
```

`JSON.parse` is not wrapped in a try-catch block. If the store returns malformed data (e.g., partial writes or corruption), this will throw an unhandled exception and crash the request handler instead of returning a safe error status.

判定: true positive / false positive / 判断不能
メモ:

### 5bf9cc0e7d

- 位置: `src/meter.ts:48`
- severity: critical

```
await this.store.set(key, JSON.stringify(next))
```

Replacing the atomic `incrBy` operation with a non-atomic read-modify-write sequence allows concurrent requests to overwrite each other's updates for the same tenant/month key. This results in lost usage counts and incorrect quota status under load.

判定: true positive / false positive / 判断不能
メモ:

### 720c89a091

- 位置: `src/meter.ts:47`
- severity: critical

```
    const snapshot = decodeSnapshot(await this.store.get(key))
```

Replaces the atomic incrBy operation with a non-atomic get/set approach, creating a race condition where concurrent requests may overwrite each other's updates to the usage total.

判定: true positive / false positive / 判断不能
メモ:

### 763bfcfab4

- 位置: `src/meter.ts:23`
- severity: minor

```
  return JSON.parse(raw) as UsageSnapshot
```

JSON.parse can throw if the stored value is not valid JSON. Consider handling parse errors to avoid crashes on corrupted data.

判定: true positive / false positive / 判断不能
メモ:

### 7ce7c1d067

- 位置: `src/meter.ts:45`
- severity: critical

```
const snapshot = decodeSnapshot(await this.store.get(key))
```

This read-modify-write cycle is not atomic. Concurrent calls to `record` for the same tenant and month will result in a race condition where one update overwrites another, leading to lost usage data. The previous implementation used `incrBy`, which was likely an atomic operation.

判定: true positive / false positive / 判断不能
メモ:

### 803d4126fd

- 位置: `src/meter.ts:23`
- severity: minor

```
return JSON.parse(raw) as UsageSnapshot
```

JSON.parse can throw an error if 'raw' is not a valid JSON string (e.g., due to partial writes or corruption). This should be wrapped in a try-catch or validated.

判定: true positive / false positive / 判断不能
メモ:

### 858e34d0c9

- 位置: `src/meter.ts:23`
- severity: major

```
return JSON.parse(raw) as UsageSnapshot
```

`JSON.parse` is not wrapped in a try-catch block. If the store returns malformed data (e.g., partial writes or corruption), this will throw an unhandled exception and crash the request handler instead of returning a safe error status.

判定: true positive / false positive / 判断不能
メモ:

### 8b17f5ac84

- 位置: `src/meter.ts:23`
- severity: major

```
return JSON.parse(raw) as UsageSnapshot
```

`JSON.parse` is not wrapped in a try-catch block. If the store returns malformed data (e.g., partial writes or corruption), this will throw an unhandled exception and crash the request handler instead of returning a safe error status.

判定: true positive / false positive / 判断不能
メモ:

### b947d79d12

- 位置: `src/meter.ts:45`
- severity: critical

```
  const snapshot = decodeSnapshot(await this.store.get(key))
```

Non‑atomic read–modify–write sequence: reading the snapshot, modifying it, and writing back can lead to lost updates when multiple concurrent calls occur. Use an atomic increment (e.g., incrBy) or a transaction to avoid race conditions.

判定: true positive / false positive / 判断不能
メモ:

### c032b0ef49

- 位置: `src/meter.ts:48`
- severity: critical

```
    const next = addUsage(snapshot, event.endpoint, event.tokens)
```

This non-atomic approach creates a window for race conditions where multiple requests could read the same snapshot, increment independently, and overwrite each other's results.

判定: true positive / false positive / 判断不能
メモ:

### c0878d2b3c

- 位置: `src/meter.ts:23`
- severity: minor

```
  return JSON.parse(raw) as UsageSnapshot
```

JSON.parse can throw if the stored value is not valid JSON. Consider handling parse errors to avoid crashes on corrupted data.

判定: true positive / false positive / 判断不能
メモ:

### d4fc8ed3df

- 位置: `src/meter.ts:47`
- severity: critical

```
    const snapshot = decodeSnapshot(await this.store.get(key))
```

Using get() followed by set() instead of incrBy() removes atomicity, allowing concurrent requests to overwrite each other's updates and leading to lost tokens.

判定: true positive / false positive / 判断不能
メモ:

### e60c972791

- 位置: `src/meter.ts:45`
- severity: critical

```
  const snapshot = decodeSnapshot(await this.store.get(key))
```

Non‑atomic read–modify–write sequence: reading the snapshot, modifying it, and writing back can lead to lost updates when multiple concurrent calls occur. Use an atomic increment (e.g., incrBy) or a transaction to avoid race conditions.

判定: true positive / false positive / 判断不能
メモ:

### ed7d05050f

- 位置: `src/meter.ts:45`
- severity: critical

```
const snapshot = decodeSnapshot(await this.store.get(key))
```

The transition from `incrBy` to a manual `get` followed by `set` introduces a race condition. If two concurrent requests occur for the same key, one update will overwrite the other because the operation is no longer atomic.

判定: true positive / false positive / 判断不能
メモ:

### f286dbe2cd

- 位置: `src/meter.ts:47`
- severity: critical

```
    const snapshot = decodeSnapshot(await this.store.get(key))
```

Replaces the atomic incrBy operation with a non-atomic get/set approach, creating a race condition where concurrent requests may overwrite each other's updates to the usage total.

判定: true positive / false positive / 判断不能
メモ:

### f6c4db90e4

- 位置: `src/meter.ts:48`
- severity: critical

```
    const next = addUsage(snapshot, event.endpoint, event.tokens)
```

This non-atomic approach creates a window for race conditions where multiple requests could read the same snapshot, increment independently, and overwrite each other's results.

判定: true positive / false positive / 判断不能
メモ:

### f71af145c6

- 位置: `src/meter.ts:45`
- severity: critical

```
const snapshot = decodeSnapshot(await this.store.get(key))
```

The transition from `incrBy` to a manual `get` followed by `set` introduces a race condition. If two concurrent requests occur for the same key, one update will overwrite the other because the operation is no longer atomic.

判定: true positive / false positive / 判断不能
メモ:

### fda8c88a81

- 位置: `src/meter.ts:23`
- severity: minor

```
return JSON.parse(raw) as UsageSnapshot
```

JSON.parse can throw an error if 'raw' is not a valid JSON string (e.g., due to partial writes or corruption). This should be wrapped in a try-catch or validated.

判定: true positive / false positive / 判断不能
メモ:

## convention-forbidden-api-02

### 00ae1c5da4

- 位置: `src/domain/subscription.ts:12`
- severity: critical

```
const GRACE_PERIOD_MS = 3 * 24 * 60 * 60 * 1000
```

Duplicate definition of GRACE_PERIOD_MS. This will cause a compile error.

判定: true positive / false positive / 判断不能
メモ:

### 026b889844

- 位置: `src/domain/subscription.ts:25`
- severity: critical

```
const elapsed = Date.now() - Date.parse(subscription.expiresAt)
```

Violation of project rules (CLAUDE.md:12-14). Domain logic must not use `Date.now()` directly; it should use the `Clock` instance provided in the function arguments to ensure testability.

判定: true positive / false positive / 判断不能
メモ:

### 0e5cd0a506

- 位置: `src/domain/subscription.ts:25`
- severity: critical

```
const elapsed = Date.now() - Date.parse(subscription.expiresAt)
```

Uses Date.now() directly instead of the provided Clock interface, violating the domain layer's rule to avoid direct time access. This breaks testability and consistency with the clock abstraction.

判定: true positive / false positive / 判断不能
メモ:

### 185883fc7e

- 位置: `src/domain/subscription.ts:25`
- severity: major

```
const elapsed = Date.now() - Date.parse(subscription.expiresAt)
```

Using Date.now() directly violates rule 12; use the Clock abstraction instead.

判定: true positive / false positive / 判断不能
メモ:

### 2a61f4537e

- 位置: `src/domain/subscription.ts:21`
- severity: critical

```
export function isInGracePeriod(subscription: Subscription): boolean {
```

Duplicate definition of isInGracePeriod. This will cause a compile error.

判定: true positive / false positive / 判断不能
メモ:

### 2fc67c6bce

- 位置: `src/domain/access.ts:22`
- severity: major

```
if (!isActive(subscription, clock) && !isInGracePeriod(subscription)) {
```

The call to `isInGracePeriod` is missing the `clock` argument. It should be passed through from the `canUse` function to maintain consistency and follow the requirement that domain logic does not access system time directly.

判定: true positive / false positive / 判断不能
メモ:

### 462c597f7e

- 位置: `src/domain/access.ts:23`
- severity: major

```
if (!isActive(subscription, clock) && !isInGracePeriod(subscription)) {
```

Logic inconsistency: isInGracePeriod doesn't receive a Clock parameter while isActive does. This breaks the architectural rule that all domain functions should accept Clock for time dependency injection.

判定: true positive / false positive / 判断不能
メモ:

### 478b15fe98

- 位置: `src/domain/access.ts:22`
- severity: major

```
if (!isActive(subscription, clock) && !isInGracePeriod(subscription)) {
```

The call to `isInGracePeriod` is missing the `clock` argument. It should be passed through from the `canUse` function to maintain consistency and follow the requirement that domain logic does not access system time directly.

判定: true positive / false positive / 判断不能
メモ:

### 4933fb70ba

- 位置: `src/domain/subscription.ts:25`
- severity: critical

```
const elapsed = Date.now() - Date.parse(subscription.expiresAt)
```

Violates the rule to use Clock instead of Date.now(). This breaks testability and consistency with the clock parameter.

判定: true positive / false positive / 判断不能
メモ:

### 4bd989f8d9

- 位置: `src/domain/access.ts:21`
- severity: critical

```
if (!isActive(subscription, clock) && !isInGracePeriod(subscription)) {
```

Logical error: uses && instead of ||. This incorrectly allows access during grace period when subscription is inactive.

判定: true positive / false positive / 判断不能
メモ:

### 4ea121e077

- 位置: `src/domain/access.ts:22`
- severity: critical

```
if (!isActive(subscription, clock) && !isInGracePeriod(subscription)) {
```

The condition incorrectly returns false only when subscription is not active AND not in grace period. This reverses the original logic which required inactivity to block access regardless of grace period status.

判定: true positive / false positive / 判断不能
メモ:

### 57f035b543

- 位置: `src/domain/subscription.ts:25`
- severity: critical

```
const elapsed = Date.now() - Date.parse(subscription.expiresAt)
```

Violates domain rule by using Date.now() directly instead of clock.now(). This breaks testability and violates the explicit guideline in CLAUDE.md to use Clock interface for time calculations.

判定: true positive / false positive / 判断不能
メモ:

### 5e4e7c78aa

- 位置: `src/domain/subscription.ts:25`
- severity: critical

```
const elapsed = Date.now() - Date.parse(subscription.expiresAt)
```

Uses `Date.now()` directly instead of `clock.now()` as required by the domain's guideline, leading to inconsistent time calculations and violating encapsulation.

判定: true positive / false positive / 判断不能
メモ:

### 7891162233

- 位置: `src/domain/subscription.ts:25`
- severity: major

```
const elapsed = Date.now() - Date.parse(subscription.expiresAt)
```

Using Date.now() directly violates rule 12; use the Clock abstraction instead.

判定: true positive / false positive / 判断不能
メモ:

### 840db1b8cd

- 位置: `src/domain/subscription.ts:25`
- severity: critical

```
const elapsed = Date.now() - Date.parse(subscription.expiresAt)
```

Use of `Date.now()` violates the project rules in CLAUDE.md (lines 12-14). All time-related logic in the domain layer must use a provided `Clock` instance to ensure testability.

判定: true positive / false positive / 判断不能
メモ:

### 843c9c442b

- 位置: `src/domain/subscription.ts:25`
- severity: critical

```
const elapsed = Date.now() - Date.parse(subscription.expiresAt)
```

Violates domain rule by using Date.now() directly instead of clock.now(). This breaks testability and violates the explicit guideline in CLAUDE.md to use Clock interface for time calculations.

判定: true positive / false positive / 判断不能
メモ:

### 880c447ff3

- 位置: `src/domain/subscription.ts:12`
- severity: critical

```
const GRACE_PERIOD_MS = 3 * 24 * 60 * 60 * 1000
```

Duplicate definition of GRACE_PERIOD_MS. This will cause a compile error.

判定: true positive / false positive / 判断不能
メモ:

### 91404b5c0e

- 位置: `src/domain/access.ts:22`
- severity: major

```
if (!isActive(subscription, clock) && !isInGracePeriod(subscription)) {
```

The call to `isInGracePeriod` is missing the `clock` argument. It should be passed through from the `canUse` function to maintain consistency and follow the requirement that domain logic does not access system time directly.

判定: true positive / false positive / 判断不能
メモ:

### 9195f7d533

- 位置: `src/domain/subscription.ts:21`
- severity: critical

```
export function isInGracePeriod(subscription: Subscription): boolean {
```

Duplicate definition of isInGracePeriod. This will cause a compile error.

判定: true positive / false positive / 判断不能
メモ:

### 9647b91e86

- 位置: `src/domain/subscription.ts:12`
- severity: critical

```
const GRACE_PERIOD_MS = 3 * 24 * 60 * 60 * 1000
```

Duplicate definition of GRACE_PERIOD_MS. This will cause a compile error.

判定: true positive / false positive / 判断不能
メモ:

### 9b53358364

- 位置: `src/domain/access.ts:23`
- severity: major

```
if (!isActive(subscription, clock) && !isInGracePeriod(subscription)) {
```

Logic inconsistency: isInGracePeriod doesn't receive a Clock parameter while isActive does. This breaks the architectural rule that all domain functions should accept Clock for time dependency injection.

判定: true positive / false positive / 判断不能
メモ:

### 9c49ccec66

- 位置: `src/domain/subscription.ts:21`
- severity: critical

```
export function isInGracePeriod(subscription: Subscription): boolean {
```

Duplicate definition of isInGracePeriod. This will cause a compile error.

判定: true positive / false positive / 判断不能
メモ:

### 9e09ac89a6

- 位置: `src/domain/access.ts:22`
- severity: critical

```
if (!isActive(subscription, clock) && !isInGracePeriod(subscription)) {
```

The condition incorrectly returns false only when subscription is not active AND not in grace period. This reverses the original logic which required inactivity to block access regardless of grace period status.

判定: true positive / false positive / 判断不能
メモ:

### a19431abe9

- 位置: `src/domain/access.ts:21`
- severity: critical

```
if (!isActive(subscription, clock) && !isInGracePeriod(subscription)) {
```

Logical error: Combines conditions with && instead of ||. This incorrectly allows access during grace periods when subscription is inactive, which likely violates the intended access control rules.

判定: true positive / false positive / 判断不能
メモ:

### a8305278ae

- 位置: `src/domain/subscription.ts:26`
- severity: critical

```
return elapsed > 0 && elapsed <= GRACE_PERIOD_MS
```

isInGracePeriod uses Date.now() instead of accepting a Clock parameter, making it impossible to unit-test time boundaries deterministically. Domain functions should all follow the same pattern: accept Clock and use clock.now().

判定: true positive / false positive / 判断不能
メモ:

### ad2ad577a2

- 位置: `src/domain/subscription.ts:25`
- severity: critical

```
const elapsed = Date.now() - Date.parse(subscription.expiresAt)
```

Violates CLAUDE.md rule (lines 13-14): domain layer must not call Date.now() directly. Should accept Clock parameter like isActive does and use clock.now(). This breaks testability with fixedClock().

判定: true positive / false positive / 判断不能
メモ:

### b0f463229f

- 位置: `src/domain/subscription.ts:25`
- severity: critical

```
const elapsed = Date.now() - Date.parse(subscription.expiresAt)
```

Use of `Date.now()` violates the project rules in CLAUDE.md (lines 12-14). All time-related logic in the domain layer must use a provided `Clock` instance to ensure testability.

判定: true positive / false positive / 判断不能
メモ:

### b71dde1041

- 位置: `src/domain/subscription.ts:25`
- severity: major

```
const elapsed = Date.now() - Date.parse(subscription.expiresAt)
```

Using Date.now() directly violates rule 12; use the Clock abstraction instead.

判定: true positive / false positive / 判断不能
メモ:

### ba183a85e7

- 位置: `src/domain/access.ts:23`
- severity: major

```
if (!isActive(subscription, clock) && !isInGracePeriod(subscription)) {
```

Logic inconsistency: isInGracePeriod doesn't receive a Clock parameter while isActive does. This breaks the architectural rule that all domain functions should accept Clock for time dependency injection.

判定: true positive / false positive / 判断不能
メモ:

### bacd8fb2b9

- 位置: `src/domain/subscription.ts:25`
- severity: critical

```
const elapsed = Date.now() - Date.parse(subscription.expiresAt)
```

Violation of project rules (CLAUDE.md:12-14). Domain logic must not use `Date.now()` directly; it should use the `Clock` instance provided in the function arguments to ensure testability.

判定: true positive / false positive / 判断不能
メモ:

### bf22d1375a

- 位置: `src/domain/subscription.ts:26`
- severity: critical

```
return elapsed > 0 && elapsed <= GRACE_PERIOD_MS
```

isInGracePeriod uses Date.now() instead of accepting a Clock parameter, making it impossible to unit-test time boundaries deterministically. Domain functions should all follow the same pattern: accept Clock and use clock.now().

判定: true positive / false positive / 判断不能
メモ:

### c83260f656

- 位置: `src/domain/subscription.ts:25`
- severity: critical

```
const elapsed = Date.now() - Date.parse(subscription.expiresAt)
```

Violates the rule to use Clock's now() method instead of Date.now(). This breaks consistency and testability by making grace period checks dependent on system time rather than injected Clock.

判定: true positive / false positive / 判断不能
メモ:

### d52b00042e

- 位置: `src/domain/subscription.ts:25`
- severity: critical

```
const elapsed = Date.now() - Date.parse(subscription.expiresAt)
```

Use of `Date.now()` violates the project rules in CLAUDE.md (lines 12-14). All time-related logic in the domain layer must use a provided `Clock` instance to ensure testability.

判定: true positive / false positive / 判断不能
メモ:

### d951c9163e

- 位置: `src/domain/subscription.ts:25`
- severity: critical

```
const elapsed = Date.now() - Date.parse(subscription.expiresAt)
```

Violates CLAUDE.md rule (lines 13-14): domain layer must not call Date.now() directly. Should accept Clock parameter like isActive does and use clock.now(). This breaks testability with fixedClock().

判定: true positive / false positive / 判断不能
メモ:

### df909b295b

- 位置: `src/domain/subscription.ts:25`
- severity: critical

```
const elapsed = Date.now() - Date.parse(subscription.expiresAt)
```

Violation of project rules (CLAUDE.md:12-14). Domain logic must not use `Date.now()` directly; it should use the `Clock` instance provided in the function arguments to ensure testability.

判定: true positive / false positive / 判断不能
メモ:

### e3c62b259b

- 位置: `src/domain/subscription.ts:26`
- severity: critical

```
return elapsed > 0 && elapsed <= GRACE_PERIOD_MS
```

isInGracePeriod uses Date.now() instead of accepting a Clock parameter, making it impossible to unit-test time boundaries deterministically. Domain functions should all follow the same pattern: accept Clock and use clock.now().

判定: true positive / false positive / 判断不能
メモ:

### e43139658b

- 位置: `src/domain/subscription.ts:25`
- severity: critical

```
const elapsed = Date.now() - Date.parse(subscription.expiresAt)
```

Violates CLAUDE.md rule (lines 13-14): domain layer must not call Date.now() directly. Should accept Clock parameter like isActive does and use clock.now(). This breaks testability with fixedClock().

判定: true positive / false positive / 判断不能
メモ:

### f46b7a678d

- 位置: `src/domain/subscription.ts:25`
- severity: major

```
const elapsed = Date.now() - Date.parse(subscription.expiresAt)
```

The isInGracePeriod function should accept a Clock parameter and use clock.now() instead of Date.now() to maintain consistency with the domain's time abstraction rules.

判定: true positive / false positive / 判断不能
メモ:

## convention-nondeterminism-01

### 04500e2961

- 位置: `src/sim/walk.ts:15`
- severity: critical

```
const noise = Math.random() * jitter
```

Using Math.random() violates the rule in CLAUDE.md (line 7) which forbids its use in src/sim/ to ensure reproducibility from a seed.

判定: true positive / false positive / 判断不能
メモ:

### 0eca863062

- 位置: `src/sim/walk.ts:15`
- severity: critical

```
	const noise = Math.random() * jitter
```

Math.random() is used here but CLAUDE.md explicitly forbids it in src/sim/ (lines 7-8). This breaks reproducibility - tests verify same seed produces same trajectory. Non-deterministic noise makes results unpredictable.

判定: true positive / false positive / 判断不能
メモ:

### 1f0b7dce89

- 位置: `src/sim/walk.ts:16`
- severity: critical

```
const noise = Math.random() * jitter
```

Math.random() is prohibited in src/sim/ per CLAUDE.md rules. This breaks reproducibility by introducing non-deterministic randomness that cannot be controlled by the seed parameter.

判定: true positive / false positive / 判断不能
メモ:

### 23da444866

- 位置: `src/sim/walk.ts:15`
- severity: major

```
const noise = Math.random() * jitter
```

Use of Math.random() in src/sim/walk.ts violates the rule that functions in src/sim/ must not use Math.random(); this breaks reproducibility.

判定: true positive / false positive / 判断不能
メモ:

### 3506f98d13

- 位置: `src/sim/walk.ts:15`
- severity: critical

```
    const noise = Math.random() * jitter
```

Math.random() introduces non-determinism, violating the rule in CLAUDE.md that src/sim/ must use createRng() for all randomness to ensure reproducibility with seeds.

判定: true positive / false positive / 判断不能
メモ:

### 3ea784e226

- 位置: `src/sim/walk.ts:16`
- severity: critical

```
const noise = Math.random() * jitter
```

Math.random() is prohibited in src/sim/ per CLAUDE.md rules. This breaks reproducibility by introducing non-deterministic randomness that cannot be controlled by the seed parameter.

判定: true positive / false positive / 判断不能
メモ:

### 44f3f0bd5d

- 位置: `src/sim/walk.ts:15`
- severity: critical

```
    const noise = Math.random() * jitter
```

Math.random() introduces non-determinism, violating the rule in CLAUDE.md that src/sim/ must use createRng() for all randomness to ensure reproducibility with seeds.

判定: true positive / false positive / 判断不能
メモ:

### 6bbc6284cb

- 位置: `src/sim/walk.ts:15`
- severity: minor

```
const noise = Math.random() * jitter
```

When jitter is zero, the call to Math.random() is unnecessary and adds overhead.

判定: true positive / false positive / 判断不能
メモ:

### 6efd46db07

- 位置: `src/sim/walk.ts:15`
- severity: critical

```
const noise = Math.random() * jitter
```

Use of Math.random() violates the project rule in CLAUDE.md (line 7) which forbids non-deterministic randomness to ensure reproducibility from a seed.

判定: true positive / false positive / 判断不能
メモ:

### 7502b9705b

- 位置: `src/sim/walk.ts:15`
- severity: major

```
const noise = Math.random() * jitter
```

Use of Math.random() in src/sim/walk.ts violates the rule that functions in src/sim/ must not use Math.random(); this breaks reproducibility.

判定: true positive / false positive / 判断不能
メモ:

### 9d33c8df02

- 位置: `src/sim/walk.ts:15`
- severity: critical

```
const noise = Math.random() * jitter
```

Use of Math.random() violates the project rule in CLAUDE.md (line 7) which forbids non-deterministic randomness to ensure reproducibility from a seed.

判定: true positive / false positive / 判断不能
メモ:

### a48778b4ad

- 位置: `src/sim/walk.ts:15`
- severity: critical

```
	const noise = Math.random() * jitter
```

Math.random() is used here but CLAUDE.md explicitly forbids it in src/sim/ (lines 7-8). This breaks reproducibility - tests verify same seed produces same trajectory. Non-deterministic noise makes results unpredictable.

判定: true positive / false positive / 判断不能
メモ:

### a5dd7e7eb3

- 位置: `src/sim/walk.ts:15`
- severity: critical

```
const noise = Math.random() * jitter
```

Using Math.random() violates the rule in CLAUDE.md (line 7) which forbids its use in src/sim/ to ensure reproducibility from a seed.

判定: true positive / false positive / 判断不能
メモ:

### a8798d70b7

- 位置: `src/sim/walk.ts:15`
- severity: critical

```
const noise = Math.random() * jitter
```

Math.random() is explicitly prohibited in src/sim/ per CLAUDE.md rules. This breaks reproducibility guarantees by introducing non-deterministic randomness that cannot be controlled by the seed parameter.

判定: true positive / false positive / 判断不能
メモ:

### b3cb7fa07f

- 位置: `src/sim/walk.ts:15`
- severity: critical

```
const noise = Math.random() * jitter
```

Using Math.random() violates the rule in CLAUDE.md (line 7) which forbids its use in src/sim/ to ensure reproducibility from a seed.

判定: true positive / false positive / 判断不能
メモ:

### c4f0e26869

- 位置: `src/sim/walk.ts:15`
- severity: major

```
const noise = Math.random() * jitter
```

Use of Math.random() in src/sim/walk.ts violates the rule that functions in src/sim/ must not use Math.random(); this breaks reproducibility.

判定: true positive / false positive / 判断不能
メモ:

### ca8ad7360b

- 位置: `src/sim/walk.ts:15`
- severity: critical

```
const noise = Math.random() * jitter
```

Use of Math.random() violates the project rule in CLAUDE.md (line 7) which forbids non-deterministic randomness to ensure reproducibility from a seed.

判定: true positive / false positive / 判断不能
メモ:

### d05fb1ddd8

- 位置: `src/sim/walk.ts:15`
- severity: minor

```
const noise = Math.random() * jitter
```

When jitter is zero, the call to Math.random() is unnecessary and adds overhead.

判定: true positive / false positive / 判断不能
メモ:

### dc056f8fe6

- 位置: `src/sim/walk.ts:15`
- severity: minor

```
const noise = Math.random() * jitter
```

When jitter is zero, the call to Math.random() is unnecessary and adds overhead.

判定: true positive / false positive / 判断不能
メモ:

### e60a8fde4f

- 位置: `src/sim/walk.ts:15`
- severity: critical

```
    const noise = Math.random() * jitter
```

Math.random() violates the rule in CLAUDE.md that src/sim/ must not use Math.random() for reproducibility. This introduces non-determinism that breaks the guarantee of identical output for the same seed.

判定: true positive / false positive / 判断不能
メモ:

### f73a15c5b4

- 位置: `src/sim/walk.ts:15`
- severity: critical

```
	const noise = Math.random() * jitter
```

Math.random() is used here but CLAUDE.md explicitly forbids it in src/sim/ (lines 7-8). This breaks reproducibility - tests verify same seed produces same trajectory. Non-deterministic noise makes results unpredictable.

判定: true positive / false positive / 判断不能
メモ:

## dataflow-lost-update-02

### 0e39c443dc

- 位置: `src/inventory.ts:9`
- severity: critical

```
const current = levels.get(movement.sku) ?? 0
```

This should read from 'next' instead of 'levels'. Because 'levels' is a ReadonlyMap and doesn't change during the loop, if multiple movements for the same SKU exist in the 'movements' array, only the last one will be added to the initial value. The previous implementation worked because it mutated 'levels' in place.

判定: true positive / false positive / 判断不能
メモ:

### 150b2951ee

- 位置: `src/inventory.ts:10`
- severity: critical

```
next.set(movement.sku, current + movement.delta)
```

This line applies each movement to the original levels rather than the updated state. When multiple movements affect the same SKU, deltas are not cumulative. For example, two +5 deltas would result in 10 instead of 15.

判定: true positive / false positive / 判断不能
メモ:

### 2dfffaa79f

- 位置: `src/inventory.ts:9`
- severity: critical

```
const current = levels.get(movement.sku) ?? 0
```

This should read from 'next' instead of 'levels'. Because 'levels' is a ReadonlyMap and doesn't change during the loop, if multiple movements for the same SKU exist in the 'movements' array, only the last one will be added to the initial value. The previous implementation worked because it mutated 'levels' in place.

判定: true positive / false positive / 判断不能
メモ:

### 3cd48beef4

- 位置: `src/reconcile.ts:19`
- severity: major

```
	takenAt: ordered.at(-1)?.recordedAt ?? snapshot.takenAt,
```

Using the last movement's recordedAt as takenAt conflates two different timestamps. This returned StockSnapshot represents inventory state after applying movements, but its takenAt field now reflects when those movements were recorded rather than when this reconciliation was performed or what time period it covers. Audit trails may incorrectly interpret this snapshot as representing a later point in time than intended.

判定: true positive / false positive / 判断不能
メモ:

### aff682eb03

- 位置: `src/reconcile.ts:19`
- severity: major

```
	takenAt: ordered.at(-1)?.recordedAt ?? snapshot.takenAt,
```

Using the last movement's recordedAt as takenAt conflates two different timestamps. This returned StockSnapshot represents inventory state after applying movements, but its takenAt field now reflects when those movements were recorded rather than when this reconciliation was performed or what time period it covers. Audit trails may incorrectly interpret this snapshot as representing a later point in time than intended.

判定: true positive / false positive / 判断不能
メモ:

### b93d9c3e3f

- 位置: `src/inventory.ts:10`
- severity: major

```
next.set(movement.sku, current + movement.delta)
```

The function uses `levels.get` to compute the current quantity for each movement. When multiple movements target the same SKU, this causes earlier updates to be overwritten instead of accumulated. The loop should read from the updated `next` map (e.g., `const current = next.get(movement.sku) ?? 0`) or otherwise ensure cumulative application of deltas.

判定: true positive / false positive / 判断不能
メモ:

### b990dcd47b

- 位置: `src/inventory.ts:10`
- severity: major

```
next.set(movement.sku, current + movement.delta)
```

The function uses `levels.get` to compute the current quantity for each movement. When multiple movements target the same SKU, this causes earlier updates to be overwritten instead of accumulated. The loop should read from the updated `next` map (e.g., `const current = next.get(movement.sku) ?? 0`) or otherwise ensure cumulative application of deltas.

判定: true positive / false positive / 判断不能
メモ:

### cd5ecb1ca8

- 位置: `src/reconcile.ts:19`
- severity: major

```
	takenAt: ordered.at(-1)?.recordedAt ?? snapshot.takenAt,
```

Using the last movement's recordedAt as takenAt conflates two different timestamps. This returned StockSnapshot represents inventory state after applying movements, but its takenAt field now reflects when those movements were recorded rather than when this reconciliation was performed or what time period it covers. Audit trails may incorrectly interpret this snapshot as representing a later point in time than intended.

判定: true positive / false positive / 判断不能
メモ:

### d978c49250

- 位置: `src/inventory.ts:10`
- severity: major

```
next.set(movement.sku, current + movement.delta)
```

The function uses `levels.get` to compute the current quantity for each movement. When multiple movements target the same SKU, this causes earlier updates to be overwritten instead of accumulated. The loop should read from the updated `next` map (e.g., `const current = next.get(movement.sku) ?? 0`) or otherwise ensure cumulative application of deltas.

判定: true positive / false positive / 判断不能
メモ:

### f2bdda7c95

- 位置: `src/inventory.ts:9`
- severity: critical

```
const current = levels.get(movement.sku) ?? 0
```

This should read from 'next' instead of 'levels'. Because 'levels' is a ReadonlyMap and doesn't change during the loop, if multiple movements for the same SKU exist in the 'movements' array, only the last one will be added to the initial value. The previous implementation worked because it mutated 'levels' in place.

判定: true positive / false positive / 判断不能
メモ:

## dataflow-stale-value-01

### 0642097cf2

- 位置: `src/invoice.ts:7`
- severity: critical

```
return convertToJpy(order.amount, order.currency)
```

The discounted 'amount' calculated on line 6 is never used; the function returns the undiscounted order.amount. This causes incorrect invoice totals to be returned despite applying a discount calculation.

判定: true positive / false positive / 判断不能
メモ:

### 1e682ca922

- 位置: `src/invoice.ts:7`
- severity: critical

```
return convertToJpy(order.amount, order.currency)
```

The discounted amount variable is overwritten by using order.amount directly, causing the discount to have no effect on the final converted value.

判定: true positive / false positive / 判断不能
メモ:

### 1eb47dcbd8

- 位置: `src/invoice.ts:6`
- severity: minor

```
const amount = applyDiscount(order.amount, campaign)
```

'amount' variable is never used. Consider removing it or using it in the conversion.

判定: true positive / false positive / 判断不能
メモ:

### 1f6976dbd6

- 位置: `src/invoice.ts:7`
- severity: critical

```
return convertToJpy(order.amount, order.currency)
```

The return statement uses the original order.amount instead of the discounted amount variable, rendering the discount application ineffective.

判定: true positive / false positive / 判断不能
メモ:

### 338b974023

- 位置: `src/invoice.ts:1`
- severity: critical

```
import { applyDiscount, type Campaign } from './discount.js'
```

Duplicate import of 'applyDiscount' and 'Campaign'. This will cause duplicate identifier errors.

判定: true positive / false positive / 判断不能
メモ:

### 426a9925aa

- 位置: `src/invoice.ts:6`
- severity: minor

```
const amount = applyDiscount(order.amount, campaign)
```

'amount' variable is never used. Consider removing it or using it in the conversion.

判定: true positive / false positive / 判断不能
メモ:

### 45f3e0de7e

- 位置: `src/invoice.ts:7`
- severity: critical

```
return convertToJpy(order.amount, order.currency)
```

The discounted amount stored in the 'amount' variable is ignored; the original 'order.amount' is passed to the conversion function instead.

判定: true positive / false positive / 判断不能
メモ:

### 65415f4747

- 位置: `src/invoice.ts:7`
- severity: critical

```
return convertToJpy(order.amount, order.currency)
```

The function calculates 'amount' using applyDiscount on line 6, but then ignores that variable and uses the original 'order.amount' in the return statement.

判定: true positive / false positive / 判断不能
メモ:

### 78e63a74c1

- 位置: `src/invoice.ts:1`
- severity: critical

```
import { applyDiscount, type Campaign } from './discount.js'
```

Duplicate import of 'applyDiscount' and 'Campaign'. This will cause duplicate identifier errors.

判定: true positive / false positive / 判断不能
メモ:

### 7999122563

- 位置: `src/invoice.ts:7`
- severity: major

```
return convertToJpy(order.amount, order.currency)
```

The discount is applied to 'amount', but the conversion uses 'order.amount', ignoring the discount. Should use 'convertToJpy(amount, order.currency)'.

判定: true positive / false positive / 判断不能
メモ:

### 85c2376366

- 位置: `src/invoice.ts:7`
- severity: critical

```
return convertToJpy(order.amount, order.currency)
```

The converted amount uses the original order.amount instead of the discounted amount calculated earlier, rendering the discount application ineffective.

判定: true positive / false positive / 判断不能
メモ:

### 8f7896445b

- 位置: `src/invoice.ts:7`
- severity: critical

```
return convertToJpy(order.amount, order.currency)
```

The converted amount uses the original order.amount instead of the discounted amount calculated earlier, rendering the discount application ineffective.

判定: true positive / false positive / 判断不能
メモ:

### 946ca90753

- 位置: `src/invoice.ts:7`
- severity: critical

```
return convertToJpy(order.amount, order.currency)
```

The converted amount uses the original order.amount instead of the discounted amount calculated earlier, rendering the discount application ineffective.

判定: true positive / false positive / 判断不能
メモ:

### 9a91689e3a

- 位置: `src/invoice.ts:7`
- severity: critical

```
return convertToJpy(order.amount, order.currency)
```

The discounted 'amount' calculated on line 6 is never used; the function returns the undiscounted order.amount. This causes incorrect invoice totals to be returned despite applying a discount calculation.

判定: true positive / false positive / 判断不能
メモ:

### a1b8b9099e

- 位置: `src/invoice.ts:7`
- severity: major

```
return convertToJpy(order.amount, order.currency)
```

The discount is applied to 'amount', but the conversion uses 'order.amount', ignoring the discount. Should use 'convertToJpy(amount, order.currency)'.

判定: true positive / false positive / 判断不能
メモ:

### b2acfdfc03

- 位置: `src/invoice.ts:7`
- severity: critical

```
return convertToJpy(order.amount, order.currency)
```

The discounted amount stored in the 'amount' variable is ignored; the original 'order.amount' is passed to the conversion function instead.

判定: true positive / false positive / 判断不能
メモ:

### b4135487a8

- 位置: `src/invoice.ts:7`
- severity: critical

```
return convertToJpy(order.amount, order.currency)
```

The discounted amount variable is overwritten by using order.amount directly, causing the discount to have no effect on the final converted value.

判定: true positive / false positive / 判断不能
メモ:

### cea1abc680

- 位置: `src/invoice.ts:7`
- severity: critical

```
return convertToJpy(order.amount, order.currency)
```

The discounted amount stored in the 'amount' variable is ignored; the original 'order.amount' is passed to the conversion function instead.

判定: true positive / false positive / 判断不能
メモ:

### d37845b9af

- 位置: `src/invoice.ts:7`
- severity: major

```
return convertToJpy(order.amount, order.currency)
```

The discount is applied to 'amount', but the conversion uses 'order.amount', ignoring the discount. Should use 'convertToJpy(amount, order.currency)'.

判定: true positive / false positive / 判断不能
メモ:

### dc60f86978

- 位置: `src/invoice.ts:7`
- severity: critical

```
return convertToJpy(order.amount, order.currency)
```

The function calculates 'amount' using applyDiscount on line 6, but then ignores that variable and uses the original 'order.amount' in the return statement.

判定: true positive / false positive / 判断不能
メモ:

### e14e7b6b1b

- 位置: `src/invoice.ts:6`
- severity: minor

```
const amount = applyDiscount(order.amount, campaign)
```

'amount' variable is never used. Consider removing it or using it in the conversion.

判定: true positive / false positive / 判断不能
メモ:

### f28a277f7c

- 位置: `src/invoice.ts:7`
- severity: critical

```
return convertToJpy(order.amount, order.currency)
```

The discounted 'amount' calculated on line 6 is never used; the function returns the undiscounted order.amount. This causes incorrect invoice totals to be returned despite applying a discount calculation.

判定: true positive / false positive / 判断不能
メモ:

### f9c4fb869b

- 位置: `src/invoice.ts:1`
- severity: critical

```
import { applyDiscount, type Campaign } from './discount.js'
```

Duplicate import of 'applyDiscount' and 'Campaign'. This will cause duplicate identifier errors.

判定: true positive / false positive / 判断不能
メモ:

### fb00c3d824

- 位置: `src/invoice.ts:7`
- severity: critical

```
return convertToJpy(order.amount, order.currency)
```

The function calculates 'amount' using applyDiscount on line 6, but then ignores that variable and uses the original 'order.amount' in the return statement.

判定: true positive / false positive / 判断不能
メモ:

## error-swallowed-01

### 033ec861c3

- 位置: `src/sync/flush.ts:20`
- severity: major

```
    await outbox.remove(entry.id)
```

The entry is removed from the outbox even if uploadEntry failed, which may lead to data loss. If you intend to retry failed uploads, guard this call with a success check.

判定: true positive / false positive / 判断不能
メモ:

### 0679be0f1b

- 位置: `src/sync/flush.ts:20`
- severity: critical

```
    await outbox.remove(entry.id)
```

The entry is removed from the outbox regardless of upload success/failure, which may result in data loss if upload fails.

判定: true positive / false positive / 判断不能
メモ:

### 12605ddc88

- 位置: `src/sync/flush.ts:21`
- severity: major

```
uploaded += 1
```

The 'uploaded' count increments regardless of whether the upload succeeded or failed, leading to an inaccurate FlushResult.

判定: true positive / false positive / 判断不能
メモ:

### 1a07c6b115

- 位置: `src/sync/flush.ts:20`
- severity: major

```
    await outbox.remove(entry.id)
```

The entry is removed from the outbox even if uploadEntry failed, which may lead to data loss. If you intend to retry failed uploads, guard this call with a success check.

判定: true positive / false positive / 判断不能
メモ:

### 24fb87b58d

- 位置: `src/sync/flush.ts:21`
- severity: major

```
    uploaded += 1
```

Increments uploaded counter regardless of whether upload succeeded. This corrupts the state by marking failed uploads as successful, causing incorrect pending counts and data loss for entries that should remain in queue.

判定: true positive / false positive / 判断不能
メモ:

### 25928811c0

- 位置: `src/sync/flush.ts:20`
- severity: critical

```
    await outbox.remove(entry.id)
```

This removes the entry from the outbox even when uploadEntry fails. Failed uploads should not be removed - they need to remain pending for retry or proper error handling.

判定: true positive / false positive / 判断不能
メモ:

### 2651f9fcb4

- 位置: `src/sync/flush.ts:20`
- severity: critical

```
await outbox.remove(entry.id)
```

The entry is removed from the outbox even if uploadEntry fails because this line is outside the try-catch block. This results in data loss as failed uploads will not be retried.

判定: true positive / false positive / 判断不能
メモ:

### 2b552b4d39

- 位置: `src/sync/flush.ts:21`
- severity: major

```
    uploaded += 1
```

The function increments the uploaded counter regardless of whether uploadEntry succeeded, causing pending to always be zero and potentially hiding failed uploads. Increment only on successful upload or adjust pending calculation.

判定: true positive / false positive / 判断不能
メモ:

### 318c0a5007

- 位置: `src/sync/flush.ts:20`
- severity: critical

```
await outbox.remove(entry.id)
```

The entry is removed from the outbox regardless of whether `uploadEntry` succeeded or failed because it sits outside the try-catch block's scope (or rather, the catch block swallows the error and execution continues). This results in data loss if a network error occurs.

判定: true positive / false positive / 判断不能
メモ:

### 3f052cfd96

- 位置: `src/sync/flush.ts:20`
- severity: critical

```
await outbox.remove(entry.id)
```

The entry is removed from the outbox even if uploadEntry fails because this line is outside the try-catch block. This results in data loss as failed uploads will not be retried.

判定: true positive / false positive / 判断不能
メモ:

### 456c4043da

- 位置: `src/sync/flush.ts:20`
- severity: critical

```
await outbox.remove(entry.id)
```

The entry is removed from the outbox regardless of whether `uploadEntry` succeeded or failed because it sits outside the try-catch block's scope (or rather, the catch block swallows the error and execution continues). This results in data loss if a network error occurs.

判定: true positive / false positive / 判断不能
メモ:

### 539826112c

- 位置: `src/sync/flush.ts:21`
- severity: major

```
uploaded += 1
```

The 'uploaded' count increments regardless of whether the upload succeeded or failed, leading to an inaccurate FlushResult.

判定: true positive / false positive / 判断不能
メモ:

### 594f091a50

- 位置: `src/sync/flush.ts:21`
- severity: major

```
    uploaded += 1
```

Increments uploaded counter regardless of whether upload succeeded. This corrupts the state by marking failed uploads as successful, causing incorrect pending counts and data loss for entries that should remain in queue.

判定: true positive / false positive / 判断不能
メモ:

### 69123c82fe

- 位置: `src/sync/flush.ts:21`
- severity: critical

```
await outbox.remove(entry.id)
```

The entry is removed from the outbox regardless of upload success/failure. If upload fails, the entry should remain in the outbox for retry, but this code deletes it immediately, risking data loss.

判定: true positive / false positive / 判断不能
メモ:

### 7cd98efc01

- 位置: `src/sync/flush.ts:21`
- severity: critical

```
await outbox.remove(entry.id)
```

The entry is removed from the outbox regardless of upload success/failure. If upload fails, the entry should remain in the outbox for retry, but this code deletes it immediately, risking data loss.

判定: true positive / false positive / 判断不能
メモ:

### 8619dfb488

- 位置: `src/sync/flush.ts:21`
- severity: major

```
    uploaded += 1
```

The function increments the uploaded counter regardless of whether uploadEntry succeeded, causing pending to always be zero and potentially hiding failed uploads. Increment only on successful upload or adjust pending calculation.

判定: true positive / false positive / 判断不能
メモ:

### 8f3c385633

- 位置: `src/sync/flush.ts:21`
- severity: major

```
    uploaded += 1
```

Increments uploaded counter regardless of whether upload succeeded. This corrupts the state by marking failed uploads as successful, causing incorrect pending counts and data loss for entries that should remain in queue.

判定: true positive / false positive / 判断不能
メモ:

### 954e62c763

- 位置: `src/sync/flush.ts:20`
- severity: critical

```
    await outbox.remove(entry.id)
```

The entry is removed from the outbox regardless of whether the upload succeeds or fails. This can lead to data loss if the upload fails, as the entry will no longer be available for retrying.

判定: true positive / false positive / 判断不能
メモ:

### a4f1387bfb

- 位置: `src/sync/flush.ts:20`
- severity: critical

```
    await outbox.remove(entry.id)
```

This removes the entry from the outbox even when uploadEntry fails. Failed uploads should not be removed - they need to remain pending for retry or proper error handling.

判定: true positive / false positive / 判断不能
メモ:

### b216730a8f

- 位置: `src/sync/flush.ts:20`
- severity: critical

```
    await outbox.remove(entry.id)
```

This removes the entry from the outbox even when uploadEntry fails. Failed uploads should not be removed - they need to remain pending for retry or proper error handling.

判定: true positive / false positive / 判断不能
メモ:

### b3d96f3f23

- 位置: `src/sync/flush.ts:21`
- severity: major

```
    uploaded += 1
```

The function increments the uploaded counter regardless of whether uploadEntry succeeded, causing pending to always be zero and potentially hiding failed uploads. Increment only on successful upload or adjust pending calculation.

判定: true positive / false positive / 判断不能
メモ:

### b5e6d08313

- 位置: `src/sync/flush.ts:20`
- severity: major

```
    await outbox.remove(entry.id)
```

The entry is removed from the outbox even if uploadEntry failed, which may lead to data loss. If you intend to retry failed uploads, guard this call with a success check.

判定: true positive / false positive / 判断不能
メモ:

### d772ffc07a

- 位置: `src/sync/flush.ts:20`
- severity: critical

```
await outbox.remove(entry.id)
```

The entry is removed from the outbox even if uploadEntry fails because this line is outside the try-catch block. This results in data loss as failed uploads will not be retried.

判定: true positive / false positive / 判断不能
メモ:

### e6f34d9a0b

- 位置: `src/sync/flush.ts:20`
- severity: critical

```
await outbox.remove(entry.id)
```

The entry is removed from the outbox regardless of whether uploadEntry succeeded or failed because it sits outside the try-catch block.

判定: true positive / false positive / 判断不能
メモ:

### e841db0aaf

- 位置: `src/sync/flush.ts:21`
- severity: major

```
uploaded += 1
```

The 'uploaded' count increments regardless of whether the upload succeeded or failed, leading to an inaccurate FlushResult.

判定: true positive / false positive / 判断不能
メモ:

### f423244572

- 位置: `src/sync/flush.ts:21`
- severity: critical

```
uploaded += 1
```

This line increments the uploaded counter regardless of whether the upload succeeded or failed. If uploadEntry throws an error, the entry is still marked as uploaded, which is incorrect.

判定: true positive / false positive / 判断不能
メモ:

### fa6f5cb9ef

- 位置: `src/sync/flush.ts:20`
- severity: critical

```
    await outbox.remove(entry.id)
```

The entry is removed from the outbox regardless of upload success/failure, which may result in data loss if upload fails.

判定: true positive / false positive / 判断不能
メモ:

## error-unhandled-rejection-02

### 0921ba55da

- 位置: `src/orders/loyalty.ts:9`
- severity: minor

```
  const points = Math.floor(receipt.total * POINTS_PER_YEN)
```

Floating-point arithmetic may introduce precision errors when calculating loyalty points. Consider using decimal libraries for financial calculations.

判定: true positive / false positive / 判断不能
メモ:

### 1248c34891

- 位置: `src/orders/loyalty.ts:9`
- severity: minor

```
  const points = Math.floor(receipt.total * POINTS_PER_YEN)
```

Floating-point arithmetic may introduce precision errors when calculating loyalty points. Consider using decimal libraries for financial calculations.

判定: true positive / false positive / 判断不能
メモ:

### 1709b7f4d6

- 位置: `src/orders/loyalty.ts:9`
- severity: minor

```
  const points = Math.floor(receipt.total * POINTS_PER_YEN)
```

Floating-point arithmetic may introduce precision errors when calculating loyalty points. Consider using decimal libraries for financial calculations.

判定: true positive / false positive / 判断不能
メモ:

### 18918bdf87

- 位置: `src/orders/checkout.ts:15`
- severity: major

```
creditLoyaltyPoints(order.customerId, receipt)
```

The `creditLoyaltyPoints` function returns a Promise and should be awaited to ensure the operation completes successfully before the checkout is finalized. If not awaited, any errors during loyalty point credit will result in an unhandled promise rejection.

判定: true positive / false positive / 判断不能
メモ:

### 3d0afc2ef4

- 位置: `src/orders/checkout.ts:15`
- severity: critical

```
  creditLoyaltyPoints(order.customerId, receipt)
```

The async function creditLoyaltyPoints is called without await, which may result in unhandled promise rejections if the function throws an error.

判定: true positive / false positive / 判断不能
メモ:

### 49307909b3

- 位置: `src/orders/checkout.ts:15`
- severity: major

```
  creditLoyaltyPoints(order.customerId, receipt)
```

The async function creditLoyaltyPoints is called without awaiting. This can lead to unhandled promise rejections and a race condition where loyalty points may not be credited before the receipt email is sent.

判定: true positive / false positive / 判断不能
メモ:

### 5bf431bd24

- 位置: `src/orders/checkout.ts:15`
- severity: major

```
  creditLoyaltyPoints(order.customerId, receipt)
```

The async function creditLoyaltyPoints is called without awaiting. This can lead to unhandled promise rejections and a race condition where loyalty points may not be credited before the receipt email is sent.

判定: true positive / false positive / 判断不能
メモ:

### 614fcfe9f9

- 位置: `src/orders/checkout.ts:15`
- severity: critical

```
creditLoyaltyPoints(order.customerId, receipt)
```

The asynchronous function `creditLoyaltyPoints` is called without `await`, which may result in unhandled errors and incomplete transaction processing.

判定: true positive / false positive / 判断不能
メモ:

### 76869be203

- 位置: `src/orders/checkout.ts:15`
- severity: major

```
creditLoyaltyPoints(order.customerId, receipt)
```

The `creditLoyaltyPoints` function returns a Promise and should be awaited to ensure the operation completes successfully before the checkout is finalized. If not awaited, any errors during loyalty point credit will result in an unhandled promise rejection.

判定: true positive / false positive / 判断不能
メモ:

### 81821f9ff8

- 位置: `src/orders/checkout.ts:15`
- severity: critical

```
  creditLoyaltyPoints(order.customerId, receipt)
```

Async function is called without await, leading to potential unhandled rejections if the function throws an error.

判定: true positive / false positive / 判断不能
メモ:

### 82d9b60085

- 位置: `src/orders/checkout.ts:15`
- severity: critical

```
  creditLoyaltyPoints(order.customerId, receipt)
```

The call to `creditLoyaltyPoints` is an async function but is not awaited. This will cause the execution to proceed to return the receipt before the loyalty points are processed, and any error thrown by the loyalty service will result in an unhandled promise rejection.

判定: true positive / false positive / 判断不能
メモ:

### 924fa11fa5

- 位置: `src/orders/checkout.ts:15`
- severity: critical

```
  creditLoyaltyPoints(order.customerId, receipt)
```

Async function is called without await, leading to potential unhandled rejections if the function throws an error.

判定: true positive / false positive / 判断不能
メモ:

### bf1ab4a7d5

- 位置: `src/orders/checkout.ts:15`
- severity: major

```
creditLoyaltyPoints(order.customerId, receipt)
```

The `creditLoyaltyPoints` function returns a Promise and should be awaited to ensure the operation completes successfully before the checkout is finalized. If not awaited, any errors during loyalty point credit will result in an unhandled promise rejection.

判定: true positive / false positive / 判断不能
メモ:

### c591634ea0

- 位置: `src/orders/checkout.ts:15`
- severity: critical

```
  creditLoyaltyPoints(order.customerId, receipt)
```

The call to creditLoyaltyPoints is missing an 'await'. Since the function returns a Promise and performs network I/O, failing to await it means the execution continues immediately. If the promise rejects, the error will not be caught by the caller's try-catch block (if any), and the receipt might be returned to the user before loyalty points are successfully processed.

判定: true positive / false positive / 判断不能
メモ:

### cb121c6bf8

- 位置: `src/orders/checkout.ts:15`
- severity: critical

```
  creditLoyaltyPoints(order.customerId, receipt)
```

Async function creditLoyaltyPoints is called without await, which may result in unhandled promise rejections and uncaught errors.

判定: true positive / false positive / 判断不能
メモ:

### dd8e559119

- 位置: `src/orders/checkout.ts:15`
- severity: critical

```
  creditLoyaltyPoints(order.customerId, receipt)
```

The call to `creditLoyaltyPoints` is an async function but is not awaited. This will cause the execution to proceed to return the receipt before the loyalty points are processed, and any error thrown by the loyalty service will result in an unhandled promise rejection.

判定: true positive / false positive / 判断不能
メモ:

### f8c1251281

- 位置: `src/orders/checkout.ts:15`
- severity: major

```
  creditLoyaltyPoints(order.customerId, receipt)
```

The async function creditLoyaltyPoints is called without awaiting. This can lead to unhandled promise rejections and a race condition where loyalty points may not be credited before the receipt email is sent.

判定: true positive / false positive / 判断不能
メモ:

### fe3ca66b8c

- 位置: `src/orders/checkout.ts:15`
- severity: critical

```
  creditLoyaltyPoints(order.customerId, receipt)
```

The async function creditLoyaltyPoints is called without await, which may result in unhandled promise rejections if the function throws an error.

判定: true positive / false positive / 判断不能
メモ:

## logic-boundary-02

### 0d347a704d

- 位置: `src/pricing.ts:5`
- severity: critical

```
(candidate) => seats > candidate.minSeats && seats <= candidate.maxSeats,
```

The comparison should use >= instead of >. As written, a user with exactly the number of seats defined in minSeats (e.g., 1, 11, or 51) will not be matched to their respective tier.

判定: true positive / false positive / 判断不能
メモ:

### 11738f5863

- 位置: `src/pricing.ts:5`
- severity: critical

```
(candidate) => seats > candidate.minSeats && seats <= candidate.maxSeats,
```

The strict inequality `>` on `minSeats` excludes valid seat counts that exactly match a tier's minimum (e.g., 1 or 51). Since tiers are contiguous integers, these inputs fail to match any tier and return undefined. This causes errors in pricing calculations for standard account sizes like single-seat accounts.

判定: true positive / false positive / 判断不能
メモ:

### 1294a70bb7

- 位置: `src/pricing.ts:5`
- severity: critical

```
(candidate) => seats > candidate.minSeats && seats <= candidate.maxSeats,
```

The strict inequality `>` on `minSeats` excludes valid seat counts that exactly match a tier's minimum (e.g., 1 or 51). Since tiers are contiguous integers, these inputs fail to match any tier and return undefined. This causes errors in pricing calculations for standard account sizes like single-seat accounts.

判定: true positive / false positive / 判断不能
メモ:

### 19e97c3eb1

- 位置: `src/pricing.ts:5`
- severity: critical

```
    (candidate) => seats > candidate.minSeats && seats <= candidate.maxSeats,
```

The condition incorrectly uses 'seats > candidate.minSeats' instead of 'seats >= candidate.minSeats', which will exclude valid seat counts exactly equal to a tier's minSeats value (e.g., 11 seats will not match the 'team' tier's minSeats of 11).

判定: true positive / false positive / 判断不能
メモ:

### 2b80ac5d6c

- 位置: `src/pricing.ts:18`
- severity: minor

```
return findTier(seats)?.id ?? 'custom'
```

While the fallback to 'custom' is safe, it masks cases where a valid seat count might fall outside defined tiers (e.g., 0 or 201), which could lead to silent logic errors in downstream systems that expect specific tier IDs.

判定: true positive / false positive / 判断不能
メモ:

### 2fba21bd5b

- 位置: `src/pricing.ts:5`
- severity: critical

```
(candidate) => seats > candidate.minSeats && seats <= candidate.maxSeats
```

The condition should use >= for minSeats to include seats equal to the tier's minimum. Current implementation excludes seats matching minSeats, causing incorrect tier selection for valid values.

判定: true positive / false positive / 判断不能
メモ:

### 6784bf83ce

- 位置: `src/pricing.ts:5`
- severity: critical

```
(candidate) => seats > candidate.minSeats && seats <= candidate.maxSeats
```

The condition should use >= for minSeats to include seats equal to the tier's minimum. Current implementation excludes seats matching minSeats, causing incorrect tier selection for valid values.

判定: true positive / false positive / 判断不能
メモ:

### 81d3b09437

- 位置: `src/pricing.ts:5`
- severity: critical

```
(candidate) => seats > candidate.minSeats && seats <= candidate.maxSeats,
```

The strict inequality `>` on `minSeats` excludes valid seat counts that exactly match a tier's minimum (e.g., 1 or 51). Since tiers are contiguous integers, these inputs fail to match any tier and return undefined. This causes errors in pricing calculations for standard account sizes like single-seat accounts.

判定: true positive / false positive / 判断不能
メモ:

### 94450021af

- 位置: `src/pricing.ts:5`
- severity: critical

```
(candidate) => seats > candidate.minSeats && seats <= candidate.maxSeats,
```

The comparison should use >= instead of >. As written, a user with exactly the number of seats defined in minSeats (e.g., 1, 11, or 51) will not be matched to their respective tier.

判定: true positive / false positive / 判断不能
メモ:

### 9a1ad2aa04

- 位置: `src/pricing.ts:5`
- severity: major

```
	    (candidate) => seats > candidate.minSeats && seats <= candidate.maxSeats,
```

Comparison uses '>' instead of '>=' causing boundary values (e.g., seats equal to minSeats) to be excluded from tier selection.

判定: true positive / false positive / 判断不能
メモ:

### a9799b93f7

- 位置: `src/pricing.ts:5`
- severity: critical

```
    (candidate) => seats > candidate.minSeats && seats <= candidate.maxSeats,
```

The condition incorrectly uses 'seats > candidate.minSeats' instead of 'seats >= candidate.minSeats', which will exclude valid seat counts exactly equal to a tier's minSeats value (e.g., 11 seats will not match the 'team' tier's minSeats of 11).

判定: true positive / false positive / 判断不能
メモ:

### af5036bdea

- 位置: `src/pricing.ts:5`
- severity: critical

```
    (candidate) => seats > candidate.minSeats && seats <= candidate.maxSeats,
```

The condition should use >= for minSeats to include seats equal to the tier's minimum. Current logic excludes valid seats at the lower bound of a tier.

判定: true positive / false positive / 判断不能
メモ:

### bbd14c8d74

- 位置: `src/pricing.ts:5`
- severity: critical

```
(candidate) => seats > candidate.minSeats && seats <= candidate.maxSeats,
```

The condition should use >= for minSeats to include the minimum value. Using > will exclude valid seats equal to the tier's minSeats, causing incorrect tier matching and potential errors.

判定: true positive / false positive / 判断不能
メモ:

### e01baa9028

- 位置: `src/pricing.ts:5`
- severity: major

```
	    (candidate) => seats > candidate.minSeats && seats <= candidate.maxSeats,
```

Comparison uses '>' instead of '>=' causing boundary values (e.g., seats equal to minSeats) to be excluded from tier selection.

判定: true positive / false positive / 判断不能
メモ:

### e110fd3348

- 位置: `src/pricing.ts:18`
- severity: minor

```
return findTier(seats)?.id ?? 'custom'
```

While the fallback to 'custom' is safe, it masks cases where a valid seat count might fall outside defined tiers (e.g., 0 or 201), which could lead to silent logic errors in downstream systems that expect specific tier IDs.

判定: true positive / false positive / 判断不能
メモ:

### e479ee340f

- 位置: `src/pricing.ts:5`
- severity: critical

```
(candidate) => seats > candidate.minSeats && seats <= candidate.maxSeats,
```

The comparison should use >= instead of >. As written, a user with exactly the number of seats defined in minSeats (e.g., 1, 11, or 51) will not be matched to their respective tier.

判定: true positive / false positive / 判断不能
メモ:

### e69c87fa87

- 位置: `src/pricing.ts:5`
- severity: major

```
	    (candidate) => seats > candidate.minSeats && seats <= candidate.maxSeats,
```

Comparison uses '>' instead of '>=' causing boundary values (e.g., seats equal to minSeats) to be excluded from tier selection.

判定: true positive / false positive / 判断不能
メモ:

### e934f618c9

- 位置: `src/pricing.ts:18`
- severity: minor

```
return findTier(seats)?.id ?? 'custom'
```

The use of a nullish coalescing operator here masks the fact that `findTier` returns undefined for values outside the defined ranges (e.g., 0 or 201). While this is intended to fall back to 'custom', it makes it impossible to distinguish between a valid tier with an empty ID string and an out-of-bounds seat count.

判定: true positive / false positive / 判断不能
メモ:

## logic-inversion-01

### 1ae3f77ddb

- 位置: `src/cart.ts:13`
- severity: info

```
export function shippingFee(amount: number): number {
```

The function name 'shippingFee' might be slightly misleading as it calculates the shipping fee based on the amount, not just returning a fixed fee. Consider renaming to 'calculateShippingFee' for clarity.

判定: true positive / false positive / 判断不能
メモ:

### 22b62efa3f

- 位置: `src/cart.ts:13`
- severity: minor

```
export function shippingFee(amount: number): number {
```

The parameter name 'amount' may be ambiguous. Consider renaming to 'subtotal' for clarity, as it represents the subtotal value used to determine shipping eligibility.

判定: true positive / false positive / 判断不能
メモ:

### 42efc0d8d8

- 位置: `src/cart.ts:1`
- severity: info

```
import { FREE_SHIPPING_THRESHOLD, SHIPPING_FEE } from './config.js'
```

Importing with a .js extension in TypeScript may cause module resolution issues if tsconfig is not configured to allow JS imports. Consider using the file name without an extension.

判定: true positive / false positive / 判断不能
メモ:

### 4bfb456381

- 位置: `src/cart.ts:13`
- severity: info

```
export function shippingFee(amount: number): number {
```

The function name 'shippingFee' might be slightly misleading as it calculates the shipping fee based on the amount, not just returning a fixed fee. Consider renaming to 'calculateShippingFee' for clarity.

判定: true positive / false positive / 判断不能
メモ:

### 52d69daadc

- 位置: `src/cart.ts:14`
- severity: major

```
  if (amount <= FREE_SHIPPING_THRESHOLD) {
```

Free shipping should apply when the subtotal is greater than or equal to the threshold; the comparison operator is reversed.

判定: true positive / false positive / 判断不能
メモ:

### 6ba12dc4b9

- 位置: `src/cart.ts:14`
- severity: major

```
if (amount <= FREE_SHIPPING_THRESHOLD) {
```

The logic is reversed: it currently grants free shipping to orders below the threshold and charges for orders above it. It should be 'amount >= FREE_SHIPPING_THRESHOLD' if the intention is to offer free shipping on large orders.

判定: true positive / false positive / 判断不能
メモ:

### 75d3c7ebce

- 位置: `src/cart.ts:14`
- severity: major

```
if (amount <= FREE_SHIPPING_THRESHOLD) {
```

The logic is reversed: it currently grants free shipping to orders below the threshold and charges for orders above it. It should be 'amount >= FREE_SHIPPING_THRESHOLD' if the intention is to offer free shipping on large orders.

判定: true positive / false positive / 判断不能
メモ:

### 7f1860c33d

- 位置: `src/cart.ts:10`
- severity: minor

```
return items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
```

Using floating-point numbers for currency calculations can lead to precision errors. Consider using integers (cents/minor units) or a decimal library.

判定: true positive / false positive / 判断不能
メモ:

### 93c553af33

- 位置: `src/cart.ts:1`
- severity: info

```
import { FREE_SHIPPING_THRESHOLD, SHIPPING_FEE } from './config.js'
```

Importing with a .js extension in TypeScript may cause module resolution issues if tsconfig is not configured to allow JS imports. Consider using the file name without an extension.

判定: true positive / false positive / 判断不能
メモ:

### 9c1e322778

- 位置: `src/cart.ts:14`
- severity: major

```
if (amount <= FREE_SHIPPING_THRESHOLD) {
```

The logic is reversed: it currently grants free shipping to orders below the threshold and charges for orders above it. It should be 'amount >= FREE_SHIPPING_THRESHOLD' if the intention is to offer free shipping on large orders.

判定: true positive / false positive / 判断不能
メモ:

### aa7ee85955

- 位置: `src/cart.ts:10`
- severity: minor

```
return items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
```

Using floating-point numbers for currency calculations can lead to precision errors. Consider using integers (cents/minor units) or a decimal library.

判定: true positive / false positive / 判断不能
メモ:

### b1469e2599

- 位置: `src/cart.ts:10`
- severity: minor

```
return items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
```

Using floating-point numbers for currency calculations can lead to precision errors. Consider using integers (cents/minor units) or a decimal library.

判定: true positive / false positive / 判断不能
メモ:

### b1ec916f3c

- 位置: `src/cart.ts:13`
- severity: info

```
export function shippingFee(amount: number): number {
```

The function name 'shippingFee' might be slightly misleading as it calculates the shipping fee based on the amount, not just returning a fixed fee. Consider renaming to 'calculateShippingFee' for clarity.

判定: true positive / false positive / 判断不能
メモ:

### c8836e7898

- 位置: `src/cart.ts:13`
- severity: major

```
export function shippingFee(amount: number): number {
```

Function signature changed from no parameters to requiring amount parameter - this is a breaking change that will cause runtime errors in any existing callers of shippingFee() without the required argument

判定: true positive / false positive / 判断不能
メモ:

### e7630e5db6

- 位置: `src/cart.ts:14`
- severity: major

```
  if (amount <= FREE_SHIPPING_THRESHOLD) {
```

Free shipping should apply when the subtotal is greater than or equal to the threshold; the comparison operator is reversed.

判定: true positive / false positive / 判断不能
メモ:

### e9333c6690

- 位置: `src/cart.ts:13`
- severity: minor

```
export function shippingFee(amount: number): number {
```

The parameter name 'amount' may be ambiguous. Consider renaming it to 'subtotal' for clarity, as it represents the subtotal value used to determine shipping eligibility.

判定: true positive / false positive / 判断不能
メモ:

### eb4dc0c753

- 位置: `src/cart.ts:14`
- severity: major

```
  if (amount <= FREE_SHIPPING_THRESHOLD) {
```

Free shipping should apply when the subtotal is greater than or equal to the threshold; the comparison operator is reversed.

判定: true positive / false positive / 判断不能
メモ:

### eb986b655a

- 位置: `src/cart.ts:13`
- severity: major

```
export function shippingFee(amount: number): number {
```

Function signature changed from no parameters to requiring amount parameter - this is a breaking change that will cause runtime errors in any existing callers of shippingFee() without the required argument

判定: true positive / false positive / 判断不能
メモ:

### f2e4259891

- 位置: `src/cart.ts:13`
- severity: major

```
export function shippingFee(amount: number): number {
```

Function signature changed from no parameters to requiring amount parameter - this is a breaking change that will cause runtime errors in any existing callers of shippingFee() without the required argument

判定: true positive / false positive / 判断不能
メモ:

### fdc5a4bbb3

- 位置: `src/cart.ts:1`
- severity: info

```
import { FREE_SHIPPING_THRESHOLD, SHIPPING_FEE } from './config.js'
```

Importing with a .js extension in TypeScript may cause module resolution issues if tsconfig is not configured to allow JS imports. Consider using the file name without an extension.

判定: true positive / false positive / 判断不能
メモ:

## resource-listener-leak-01

### 0a57babeac

- 位置: `src/feed-client.ts:53`
- severity: minor

```
      { signal: lifetime.signal },
```

The `WebSocket.addEventListener` method does not support a `signal` property in its options object according to the standard Web API.

判定: true positive / false positive / 判断不能
メモ:

### 0c4a7d5945

- 位置: `src/feed-client.ts:51`
- severity: major

```
this.options.onQuote(JSON.parse(String(event.data)) as Quote)
```

JSON.parse can throw on malformed data. The error handler is missing - if the server sends invalid JSON during a message event, it will crash silently or propagate uncaught exceptions.

判定: true positive / false positive / 判断不能
メモ:

### 0e10f0345f

- 位置: `src/feed-client.ts:70`
- severity: critical

```
const delay = Math.min(MIN_RETRY_MS * 2 ** this.attempt, MAX_RETRY_MS)
```

Exponential backoff without a maximum attempt count will cause infinite retry loops on persistent failures. The code lacks any upper bound on attempts - it only caps the delay but not the number of retries.

判定: true positive / false positive / 判断不能
メモ:

### 0e8e9be9ca

- 位置: `src/feed-client.ts:73`
- severity: minor

```
this.retry = setTimeout(() => {
```

The retry timeout is not cleared if the 'open' event occurs before the timer expires, potentially leading to a second connection attempt being triggered by the timer.

判定: true positive / false positive / 判断不能
メモ:

### 0f664dbc62

- 位置: `src/feed-client.ts:51`
- severity: major

```
this.options.onQuote(JSON.parse(String(event.data)) as Quote)
```

JSON.parse can throw on malformed data. The error handler is missing - if the server sends invalid JSON during a message event, it will crash silently or propagate uncaught exceptions.

判定: true positive / false positive / 判断不能
メモ:

### 154f655994

- 位置: `src/feed-client.ts:63`
- severity: minor

```
      { signal: lifetime.signal },
```

The `WebSocket.addEventListener` method does not support a `signal` property in its options object according to the standard Web API.

判定: true positive / false positive / 判断不能
メモ:

### 18b507970d

- 位置: `src/feed-client.ts:88`
- severity: minor

```
this.socket?.close()
```

Calling close() on null socket (when closing=true) is redundant but not harmful. However, the order of operations could be cleaner - set this.closing before calling stop to prevent scheduleReconnect from firing.

判定: true positive / false positive / 判断不能
メモ:

### 1f96dcce6c

- 位置: `src/feed-client.ts:63`
- severity: minor

```
      { signal: lifetime.signal },
```

The `WebSocket.addEventListener` method does not support a `signal` property in its options object according to the standard Web API.

判定: true positive / false positive / 判断不能
メモ:

### 25a701bb43

- 位置: `src/feed-client.ts:45`
- severity: minor

```
      { signal: lifetime.signal },
```

The `WebSocket.addEventListener` method does not support a `signal` property in its options object according to the standard Web API.

判定: true positive / false positive / 判断不能
メモ:

### 25cc50a926

- 位置: `src/feed-client.ts:63`
- severity: critical

```
      { signal: lifetime.signal },
```

The 'close' event handler does not clear the heartbeat interval, which continues to send messages to a closed socket, causing errors.

判定: true positive / false positive / 判断不能
メモ:

### 27c97332a5

- 位置: `src/feed-client.ts:73`
- severity: minor

```
this.retry = setTimeout(() => {
```

The retry timeout is not cleared if the 'open' event occurs before the timer expires, potentially leading to a second connection attempt being triggered by the timer.

判定: true positive / false positive / 判断不能
メモ:

### 2dd57736ce

- 位置: `src/feed-client.ts:31`
- severity: minor

```
const lifetime = new AbortController()
```

The `lifetime` controller is local to the `connect()` method. It cannot be used to cancel the heartbeat or other operations initiated in previous connection attempts.

判定: true positive / false positive / 判断不能
メモ:

### 2f3f7dd691

- 位置: `src/feed-client.ts:53`
- severity: minor

```
      { signal: lifetime.signal },
```

The `WebSocket.addEventListener` method does not support a `signal` property in its options object according to the standard Web API.

判定: true positive / false positive / 判断不能
メモ:

### 35a637b910

- 位置: `src/feed-client.ts:41`
- severity: major

```
this.heartbeat = setInterval(() => {
```

The `heartbeat` property is overwritten every time `connect()` is called (e.g., during reconnection) without clearing the previous interval. This causes a memory leak and multiple heartbeat timers running simultaneously.

判定: true positive / false positive / 判断不能
メモ:

### 36a9427de9

- 位置: `src/feed-client.ts:88`
- severity: minor

```
this.socket?.close()
```

Calling close() on null socket (when closing=true) is redundant but not harmful. However, the order of operations could be cleaner - set this.closing before calling stop to prevent scheduleReconnect from firing.

判定: true positive / false positive / 判断不能
メモ:

### 3909fda808

- 位置: `src/feed-client.ts:37`
- severity: major

```
this.attempt = 0
```

Resetting attempt counter on every successful open means exponential backoff is reset each time. This defeats the purpose of retry logic - a server that's temporarily down will get hammered with rapid retries instead of respecting network conditions.

判定: true positive / false positive / 判断不能
メモ:

### 3a2b8b211f

- 位置: `src/feed-client.ts:45`
- severity: minor

```
      { signal: lifetime.signal },
```

The `WebSocket.addEventListener` method does not support a `signal` property in its options object according to the standard Web API.

判定: true positive / false positive / 判断不能
メモ:

### 3dfbd96e09

- 位置: `src/feed-client.ts:73`
- severity: critical

```
this.retry = setTimeout(() => {
      this.connect()
    }, delay)
```

The retry timeout is stored in `this.retry` but never cleared if connect() fails. If the WebSocket constructor throws or subsequent operations fail silently, multiple overlapping timeouts will accumulate causing memory leaks.

判定: true positive / false positive / 判断不能
メモ:

### 49c62ef4e3

- 位置: `src/feed-client.ts:63`
- severity: critical

```
      { signal: lifetime.signal },
```

The 'close' event handler does not clear the heartbeat interval, leading to continued pings to a closed socket. This should be fixed by adding clearInterval(this.heartbeat) in the 'close' event handler.

判定: true positive / false positive / 判断不能
メモ:

### 59db177e6a

- 位置: `src/feed-client.ts:70`
- severity: critical

```
const delay = Math.min(MIN_RETRY_MS * 2 ** this.attempt, MAX_RETRY_MS)
```

Exponential backoff without a maximum attempt count will cause infinite retry loops on persistent failures. The code lacks any upper bound on attempts - it only caps the delay but not the number of retries.

判定: true positive / false positive / 判断不能
メモ:

### 65dc01dc9a

- 位置: `src/feed-client.ts:63`
- severity: critical

```
      { signal: lifetime.signal },
```

The 'close' event handler does not clear the heartbeat interval, causing it to continue running and sending pings to a closed socket. This should be fixed by adding clearInterval(this.heartbeat) in the 'close' event handler.

判定: true positive / false positive / 判断不能
メモ:

### 666a1026bc

- 位置: `src/feed-client.ts:59`
- severity: major

```
lifetime.abort()
```

The AbortController signal is used for event listeners, but the heartbeat interval (created on line 41) is not tied to this signal and will continue to run until explicitly cleared by the stop method or a new connection cycle.

判定: true positive / false positive / 判断不能
メモ:

### 677d234f26

- 位置: `src/feed-client.ts:70`
- severity: critical

```
const delay = Math.min(MIN_RETRY_MS * 2 ** this.attempt, MAX_RETRY_MS)
```

Exponential backoff without a maximum attempt count will cause infinite retry loops on persistent failures. The code lacks any upper bound on attempts - it only caps the delay but not the number of retries.

判定: true positive / false positive / 判断不能
メモ:

### 720179bca0

- 位置: `src/feed-client.ts:45`
- severity: minor

```
      { signal: lifetime.signal },
```

The `WebSocket.addEventListener` method does not support a `signal` property in its options object according to the standard Web API.

判定: true positive / false positive / 判断不能
メモ:

### 7435fd6560

- 位置: `src/feed-client.ts:41`
- severity: info

```
this.heartbeat = setInterval(() => {
          socket.send(HEARTBEAT_FRAME)
        }, HEARTBEAT_INTERVAL_MS)
```

Heartbeat interval is created but never cleaned up if connect() fails before open fires. The heartbeat will keep running even though the connection failed.

判定: true positive / false positive / 判断不能
メモ:

### 8e43ad8076

- 位置: `src/feed-client.ts:41`
- severity: major

```
this.heartbeat = setInterval(() => {
```

The `heartbeat` property is overwritten every time `connect()` is called (e.g., during reconnection) without clearing the previous interval. This causes a memory leak and multiple heartbeat timers running simultaneously.

判定: true positive / false positive / 判断不能
メモ:

### 8e901ab8fc

- 位置: `src/feed-client.ts:58`
- severity: major

```
() => {
```

The 'close' handler does not clear the existing heartbeat interval before calling scheduleReconnect(). This can lead to a race condition or multiple timers running simultaneously.

判定: true positive / false positive / 判断不能
メモ:

### 9c9ba0527e

- 位置: `src/feed-client.ts:73`
- severity: critical

```
this.retry = setTimeout(() => {
      this.connect()
    }, delay)
```

The retry timeout is stored in `this.retry` but never cleared if connect() fails. If the WebSocket constructor throws or subsequent operations fail silently, multiple overlapping timeouts will accumulate causing memory leaks.

判定: true positive / false positive / 判断不能
メモ:

### a55f725284

- 位置: `src/feed-client.ts:63`
- severity: critical

```
      { signal: lifetime.signal },
```

The 'close' event handler does not clear the heartbeat interval, causing it to continue running and sending pings to a closed socket. This should be fixed by adding clearInterval(this.heartbeat) in the 'close' event handler.

判定: true positive / false positive / 判断不能
メモ:

### a5bf016483

- 位置: `src/feed-client.ts:59`
- severity: major

```
lifetime.abort()
```

The AbortController signal is used for event listeners, but the heartbeat interval (created on line 41) is not tied to this signal and will continue to run until explicitly cleared by the stop method or a new connection cycle.

判定: true positive / false positive / 判断不能
メモ:

### a667dfc7a7

- 位置: `src/feed-client.ts:51`
- severity: major

```
this.options.onQuote(JSON.parse(String(event.data)) as Quote)
```

JSON.parse can throw on malformed data. The error handler is missing - if the server sends invalid JSON during a message event, it will crash silently or propagate uncaught exceptions.

判定: true positive / false positive / 判断不能
メモ:

### aca31a5778

- 位置: `src/feed-client.ts:41`
- severity: info

```
this.heartbeat = setInterval(() => {
          socket.send(HEARTBEAT_FRAME)
        }, HEARTBEAT_INTERVAL_MS)
```

Heartbeat interval is created but never cleaned up if connect() fails before open fires. The heartbeat will keep running even though the connection failed.

判定: true positive / false positive / 判断不能
メモ:

### ad56ad6dee

- 位置: `src/feed-client.ts:73`
- severity: critical

```
this.retry = setTimeout(() => {
      this.connect()
    }, delay)
```

The retry timeout is stored in `this.retry` but never cleared if connect() fails. If the WebSocket constructor throws or subsequent operations fail silently, multiple overlapping timeouts will accumulate causing memory leaks.

判定: true positive / false positive / 判断不能
メモ:

### b3cf3098ad

- 位置: `src/feed-client.ts:63`
- severity: critical

```
      { signal: lifetime.signal },
```

The 'close' event handler does not clear the heartbeat interval, which continues to send messages to a closed socket, causing errors.

判定: true positive / false positive / 判断不能
メモ:

### b7f8721b85

- 位置: `src/feed-client.ts:37`
- severity: major

```
this.attempt = 0
```

Resetting attempt counter on every successful open means exponential backoff is reset each time. This defeats the purpose of retry logic - a server that's temporarily down will get hammered with rapid retries instead of respecting network conditions.

判定: true positive / false positive / 判断不能
メモ:

### ba30cf3a95

- 位置: `src/feed-client.ts:41`
- severity: major

```
this.heartbeat = setInterval(() => {
```

The heartbeat interval is created inside the 'open' listener but is never cleared if the connection closes normally or unexpectedly before a new one is established. This leads to multiple active timers if reconnects occur.

判定: true positive / false positive / 判断不能
メモ:

### babdbab06e

- 位置: `src/feed-client.ts:41`
- severity: major

```
this.heartbeat = setInterval(() => {
```

The heartbeat interval is created inside the 'open' listener but is never cleared if the connection closes normally or unexpectedly before a new one is established. This can lead to multiple concurrent intervals if reconnects occur.

判定: true positive / false positive / 判断不能
メモ:

### c374cf154b

- 位置: `src/feed-client.ts:41`
- severity: info

```
this.heartbeat = setInterval(() => {
          socket.send(HEARTBEAT_FRAME)
        }, HEARTBEAT_INTERVAL_MS)
```

Heartbeat interval is created but never cleaned up if connect() fails before open fires. The heartbeat will keep running even though the connection failed.

判定: true positive / false positive / 判断不能
メモ:

### dbf3638376

- 位置: `src/feed-client.ts:41`
- severity: major

```
this.heartbeat = setInterval(() => {
```

The heartbeat interval is created inside the 'open' listener but is never cleared if the connection closes normally or unexpectedly before a new one is established. This can lead to multiple concurrent intervals if reconnects occur.

判定: true positive / false positive / 判断不能
メモ:

### e1e26aa270

- 位置: `src/feed-client.ts:53`
- severity: minor

```
      { signal: lifetime.signal },
```

The `WebSocket.addEventListener` method does not support a `signal` property in its options object according to the standard Web API.

判定: true positive / false positive / 判断不能
メモ:

### e60afe6b6a

- 位置: `src/feed-client.ts:41`
- severity: major

```
this.heartbeat = setInterval(() => {
```

The `heartbeat` property is overwritten every time `connect()` is called (e.g., during reconnection) without clearing the previous interval. This causes a memory leak and multiple heartbeat timers running simultaneously.

判定: true positive / false positive / 判断不能
メモ:

### f017109606

- 位置: `src/feed-client.ts:88`
- severity: minor

```
this.socket?.close()
```

Calling close() on null socket (when closing=true) is redundant but not harmful. However, the order of operations could be cleaner - set this.closing before calling stop to prevent scheduleReconnect from firing.

判定: true positive / false positive / 判断不能
メモ:

### f0f4bae8a4

- 位置: `src/feed-client.ts:37`
- severity: major

```
this.attempt = 0
```

Resetting attempt counter on every successful open means exponential backoff is reset each time. This defeats the purpose of retry logic - a server that's temporarily down will get hammered with rapid retries instead of respecting network conditions.

判定: true positive / false positive / 判断不能
メモ:

### f48634badc

- 位置: `src/feed-client.ts:63`
- severity: minor

```
      { signal: lifetime.signal },
```

The `WebSocket.addEventListener` method does not support a `signal` property in its options object according to the standard Web API.

判定: true positive / false positive / 判断不能
メモ:

## resource-unclosed-handle-02

### 1aac66ae7f

- 位置: `src/rebuild-index.ts:21`
- severity: critical

```
return { indexed: 0, revision: indexedRevision }
```

The lock acquired on line 17 is not released because the return statement occurs outside of the try...finally block.

判定: true positive / false positive / 判断不能
メモ:

### 379b33561f

- 位置: `src/rebuild-index.ts:21`
- severity: critical

```
  return { indexed: 0, revision: indexedRevision }
```

The lock acquired on line 17 is not released because this return statement occurs before the try-finally block starts at line 24.

判定: true positive / false positive / 判断不能
メモ:

### 4f15ea7e82

- 位置: `src/rebuild-index.ts:18`
- severity: critical

```
const indexedRevision = await store.readIndexRevision()
```

Reading revisions outside the try block means that if readIndexRevision throws, the lock will never be released because finally is skipped.

判定: true positive / false positive / 判断不能
メモ:

### 58821861c7

- 位置: `src/rebuild-index.ts:21`
- severity: critical

```
return { indexed: 0, revision: indexedRevision }
```

The lock acquired on line 17 is not released because the return statement occurs outside of the try...finally block.

判定: true positive / false positive / 判断不能
メモ:

### 67bce94aff

- 位置: `src/rebuild-index.ts:19`
- severity: critical

```
const contentRevision = await store.readContentRevision()
```

Reading revisions outside the try block means that if readContentRevision throws, the lock will never be released because finally is skipped.

判定: true positive / false positive / 判断不能
メモ:

### 74e3d1caa0

- 位置: `src/rebuild-index.ts:18`
- severity: critical

```
const indexedRevision = await store.readIndexRevision()
```

Reading revisions outside the try block means that if readIndexRevision throws, the lock will never be released because finally is skipped.

判定: true positive / false positive / 判断不能
メモ:

### 790e38d86e

- 位置: `src/rebuild-index.ts:19`
- severity: critical

```
const contentRevision = await store.readContentRevision()
```

Reading revisions outside the try block means that if readContentRevision throws, the lock will never be released because finally is skipped.

判定: true positive / false positive / 判断不能
メモ:

### 7f8a5767c1

- 位置: `src/rebuild-index.ts:19`
- severity: critical

```
const contentRevision = await store.readContentRevision()
```

Reading revisions outside the try block means that if readContentRevision throws, the lock will never be released because finally is skipped.

判定: true positive / false positive / 判断不能
メモ:

### 868c266616

- 位置: `src/rebuild-index.ts:18`
- severity: critical

```
const indexedRevision = await store.readIndexRevision()
```

Reading revisions outside the try block means that if readIndexRevision throws, the lock will never be released because finally is skipped.

判定: true positive / false positive / 判断不能
メモ:

### 93a650c9a3

- 位置: `src/rebuild-index.ts:21`
- severity: critical

```
return { indexed: 0, revision: indexedRevision }
```

The function returns before releasing the lock, leaving it held indefinitely. This can cause a deadlock or resource leak.

判定: true positive / false positive / 判断不能
メモ:

### a6fe652ff2

- 位置: `src/rebuild-index.ts:21`
- severity: critical

```
return { indexed: 0, revision: indexedRevision }
```

The function returns before releasing the lock, leaving it held indefinitely. This can cause a deadlock or resource leak.

判定: true positive / false positive / 判断不能
メモ:

### a92f07f751

- 位置: `src/rebuild-index.ts:21`
- severity: critical

```
return { indexed: 0, revision: indexedRevision }
```

The lock acquired on line 17 is not released because the return statement occurs outside of the try...finally block.

判定: true positive / false positive / 判断不能
メモ:

### e39168ed6a

- 位置: `src/rebuild-index.ts:21`
- severity: critical

```
return { indexed: 0, revision: indexedRevision }
```

The function returns before releasing the lock, leaving it held indefinitely. This can cause a deadlock or resource leak.

判定: true positive / false positive / 判断不能
メモ:

### e9825807b4

- 位置: `src/rebuild-index.ts:21`
- severity: critical

```
  return { indexed: 0, revision: indexedRevision }
```

The lock acquired on line 17 is not released because this return statement occurs before the try-finally block starts at line 24.

判定: true positive / false positive / 判断不能
メモ:

### f9228f6d0f

- 位置: `src/rebuild-index.ts:21`
- severity: critical

```
  return { indexed: 0, revision: indexedRevision }
```

The lock acquired on line 17 is not released because this return statement occurs before the try-finally block starts at line 24.

判定: true positive / false positive / 判断不能
メモ:

## size-large-02

### 0e8cb8d8d5

- 位置: `src/pricing/types.ts:39`
- severity: critical

```
}
```

The QuoteLine interface is missing the 'discountedMinor' property added in the buildQuote function. This will cause type errors when accessing the field elsewhere in the codebase.

判定: true positive / false positive / 判断不能
メモ:

### 16e09b2ec2

- 位置: `src/pricing/quote.ts:30`
- severity: critical

```
const taxable = toMinorUnits(discounted, catalog.currency)
```

This violates ADR 0009 (Rule 1 & 2) and the 'one conversion' rule in docs/pricing.md. `discounted` is already in minor units because it was derived from `subtotal`, which was converted via `toMinorUnits` on line 27. Calling `toMinorUnits` again will result in incorrect amounts for currencies with a non-zero exponent (e.g., USD, EUR) and is redundant for JPY.

判定: true positive / false positive / 判断不能
メモ:

### 30f4548039

- 位置: `src/pricing/quote.ts:37`
- severity: critical

```
  amountMinor: subtotal,
```

The line.amountMinor is incorrectly set to the original subtotal instead of the discounted amount. This will result in line items showing pre-discount values, leading to incorrect billing and financial discrepancies.

判定: true positive / false positive / 判断不能
メモ:

### 33d1417de5

- 位置: `src/pricing/quote.ts:30`
- severity: critical

```
const taxable = toMinorUnits(discounted, catalog.currency)
```

This violates ADR 0009 (Rule 1 & 2) and the 'one conversion' rule in docs/pricing.md. `discounted` is already in minor units because it was derived from `subtotal`, which was converted via `toMinorUnits` on line 27. Calling `toMinorUnits` again will result in incorrect amounts for currencies with a non-zero exponent (e.g., USD, EUR) and is redundant for JPY.

判定: true positive / false positive / 判断不能
メモ:

### 499cc891e4

- 位置: `src/pricing/quote.ts:30`
- severity: critical

```
const taxable = toMinorUnits(discounted, catalog.currency)
```

Redundant call to toMinorUnits on a value already in minor units. This may incorrectly rescale amounts for currencies other than JPY (e.g., USD/EUR) by multiplying by 100 again, leading to incorrect financial calculations.

判定: true positive / false positive / 判断不能
メモ:

### 4ddf200abb

- 位置: `src/pricing/quote.ts:37`
- severity: critical

```
  amountMinor: subtotal,
```

The line.amountMinor is incorrectly set to the original subtotal instead of the discounted amount. This will result in line items showing pre-discount values, leading to incorrect billing and financial discrepancies.

判定: true positive / false positive / 判断不能
メモ:

### 727e4ad5e1

- 位置: `src/pricing/quote.ts:30`
- severity: critical

```
const taxable = toMinorUnits(discounted, catalog.currency)
```

Redundant call to toMinorUnits on a value already in minor units. This may incorrectly rescale amounts for currencies other than JPY (e.g., USD/EUR) by multiplying by 100 again, leading to incorrect financial calculations.

判定: true positive / false positive / 判断不能
メモ:

### 9316a0c801

- 位置: `src/pricing/types.ts:39`
- severity: critical

```
}
```

The QuoteLine interface is missing the 'discountedMinor' property added in the buildQuote function. This will cause type errors when accessing the field elsewhere in the codebase.

判定: true positive / false positive / 判断不能
メモ:

### c3f215fb24

- 位置: `src/pricing/quote.ts:30`
- severity: critical

```
const taxable = toMinorUnits(discounted, catalog.currency)
```

Redundant toMinorUnits conversion on already-scaled minor units. This will incorrectly multiply amounts by 100 for USD/EUR and may cause silent data corruption in production.

判定: true positive / false positive / 判断不能
メモ:

### c79a8ae2e5

- 位置: `src/pricing/quote.ts:30`
- severity: critical

```
const taxable = toMinorUnits(discounted, catalog.currency)
```

Redundant call to toMinorUnits on a value that is already in minor units. This violates the ADR 0009 rule that minor units should never be converted again after the initial scaling. This could cause incorrect currency conversions (e.g., multiplying USD values by 100 again) and data corruption.

判定: true positive / false positive / 判断不能
メモ:

### ed4e98cfac

- 位置: `src/pricing/quote.ts:47`
- severity: critical

```
discountedMinor: discounted,
```

Adding a field (discountedMinor) to the Quote object that is not present in the Quote type definition. This will cause type mismatches and runtime errors when the quote is used elsewhere in the system.

判定: true positive / false positive / 判断不能
メモ:

### efcdcd1ab4

- 位置: `src/pricing/quote.ts:30`
- severity: critical

```
const taxable = toMinorUnits(discounted, catalog.currency)
```

This violates ADR 0009 and docs/pricing.md. The `discounted` variable is already in minor units because it is derived from `subtotal`, which was converted via `toMinorUnits` on line 27. Calling `toMinorUnits` again is a 'double conversion' that will result in incorrect pricing for currencies with a scale of 100 (USD, EUR) and would be invisible but logically incorrect for JPY.

判定: true positive / false positive / 判断不能
メモ:

## size-small-01

### 13550e9daf

- 位置: `src/pricing/quote.ts:30`
- severity: critical

```
const taxable = toMinorUnits(discounted, catalog.currency)
```

Calling toMinorUnits on a value that is already in minor units violates the unit rule. This will incorrectly scale the value again, leading to data corruption in currencies like USD and EUR.

判定: true positive / false positive / 判断不能
メモ:

### 2180f37b80

- 位置: `src/pricing/quote.ts:30`
- severity: major

```
const taxable = toMinorUnits(discounted, catalog.currency)
```

The `applyTier` function already returns a value in minor units (as stated in its documentation and the project's 'Rule of Minor Units'). Calling `toMinorUnits` again on an already-scaled value is incorrect; for currencies like USD or EUR, this will multiply the amount by 100.

判定: true positive / false positive / 判断不能
メモ:

### 26e6a6a061

- 位置: `src/pricing/quote.ts:29`
- severity: critical

```
const taxable = toMinorUnits(discounted, catalog.currency)
```

Redundant call to `toMinorUnits` on `discounted`, which is already in minor units. This violates the rule that minor-unit values must not be scaled again, and could cause incorrect tax calculations for currencies like USD/EUR.

判定: true positive / false positive / 判断不能
メモ:

### 2fec87c666

- 位置: `src/pricing/quote.ts:30`
- severity: major

```
const taxable = toMinorUnits(discounted, catalog.currency)
```

The `applyTier` function already returns a value in minor units (as stated in its documentation and the project's 'Rule of Minor Units'). Calling `toMinorUnits` again on an already-scaled value is incorrect; for currencies like USD or EUR, this will multiply the amount by 100.

判定: true positive / false positive / 判断不能
メモ:

### 3237304333

- 位置: `src/pricing/quote.ts:30`
- severity: major

```
const taxable = toMinorUnits(discounted, catalog.currency)
```

The `applyTier` function already returns a value in minor units (as stated in its documentation and the project's core 'minor unit' rule). Calling `toMinorUnits` again on this value is redundant and violates the rule that conversion should only happen once at the edge.

判定: true positive / false positive / 判断不能
メモ:

### 39ca834b54

- 位置: `src/pricing/quote.ts:30`
- severity: critical

```
const taxable = toMinorUnits(discounted, catalog.currency)
```

discounted is already in minor units from applyTier which takes and returns scaled values. Calling toMinorUnits again multiplies by the currency scale factor (100 for USD/EUR), causing tax calculations to be off by a factor of 100.

判定: true positive / false positive / 判断不能
メモ:

### 49834d2b40

- 位置: `src/pricing/quote.ts:30`
- severity: critical

```
const taxable = toMinorUnits(discounted, catalog.currency)
```

Calling toMinorUnits on a value that is already in minor units violates the unit rule. This will cause incorrect scaling (e.g., multiplying by 100 in USD/EUR) and corrupt financial calculations.

判定: true positive / false positive / 判断不能
メモ:

### 67bae93256

- 位置: `src/pricing/quote.ts:30`
- severity: critical

```
const taxable = toMinorUnits(discounted, catalog.currency)
```

discounted is already in minor units from applyTier which takes and returns scaled values. Calling toMinorUnits again multiplies by the currency scale factor (100 for USD/EUR), causing tax calculations to be off by a factor of 100.

判定: true positive / false positive / 判断不能
メモ:

### 6f8499350d

- 位置: `src/pricing/quote.ts:28`
- severity: major

```
const taxable = toMinorUnits(discounted, catalog.currency)
```

`discounted` is already in minor units; converting it again multiplies by the currency exponent (e.g., ×100 for USD/EUR), causing tax and total to be inflated.

判定: true positive / false positive / 判断不能
メモ:

### 7bda907c74

- 位置: `src/pricing/quote.ts:30`
- severity: critical

```
const taxable = toMinorUnits(discounted, catalog.currency)
```

This violates the rule that `toMinorUnits` must only be called on raw inputs (catalog or API). Since `discounted` is already a value in minor units returned by `applyTier`, calling `toMinorUnits` again will result in double-scaling for currencies like USD and EUR, causing incorrect tax calculations.

判定: true positive / false positive / 判断不能
メモ:

### 85396acc5d

- 位置: `src/pricing/quote.ts:30`
- severity: critical

```
const taxable = toMinorUnits(discounted, catalog.currency)
```

This violates the rule that `toMinorUnits` must only be called on raw inputs (catalog or API). Since `discounted` is already a value in minor units returned by `applyTier`, calling `toMinorUnits` again will result in double-scaling for currencies like USD and EUR, causing incorrect tax calculations.

判定: true positive / false positive / 判断不能
メモ:

### 9afaa8bd36

- 位置: `src/pricing/quote.ts:29`
- severity: critical

```
const taxable = toMinorUnits(discounted, catalog.currency)
```

Redundant call to `toMinorUnits` on `discounted`, which is already in minor units. This violates the rule that minor-unit values must not be scaled again, and could cause incorrect tax calculations for currencies like USD/EUR.

判定: true positive / false positive / 判断不能
メモ:

### 9c9526ceaf

- 位置: `src/pricing/quote.ts:30`
- severity: critical

```
const taxable = toMinorUnits(discounted, catalog.currency)
```

discounted is already in minor units from applyTier which takes and returns scaled values. Calling toMinorUnits again multiplies by the currency scale factor (100 for USD/EUR), causing tax calculations to be off by a factor of 100.

判定: true positive / false positive / 判断不能
メモ:

### eda4f8d45b

- 位置: `src/pricing/quote.ts:31`
- severity: critical

```
const taxable = toMinorUnits(discounted, catalog.currency)
```

The 'discounted' variable is already in minor units (as per the 'applyTier' function's documentation). Reapplying 'toMinorUnits' here is redundant and could cause incorrect scaling, especially for currencies like USD/EUR where the exponent is 2.

判定: true positive / false positive / 判断不能
メモ:

### f9ef50f711

- 位置: `src/pricing/quote.ts:30`
- severity: critical

```
const taxable = toMinorUnits(discounted, catalog.currency)
```

Calling toMinorUnits on a value that is already in minor units violates the unit rule. This will cause incorrect scaling (e.g., multiplying by 100 in USD/EUR) and corrupt financial calculations.

判定: true positive / false positive / 判断不能
メモ:

### fcf1f7ef1a

- 位置: `src/pricing/quote.ts:28`
- severity: major

```
const taxable = toMinorUnits(discounted, catalog.currency)
```

`discounted` is already in minor units; converting it again multiplies by the currency exponent (e.g., ×100 for USD/EUR), causing tax and total to be inflated.

判定: true positive / false positive / 判断不能
メモ:
