import { z } from 'zod';
import fetch from 'node-fetch';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { withRetry } from '../utils/retry.js';
import pLimit from 'p-limit';

// Custom URL validation function
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export const downloadFilesSchema = z.object({
  urls: z
    .array(z.string().refine(isValidUrl, { message: 'Invalid URL' }))
    .describe('Array of URLs to download'),
  directory: z.string().describe('Target directory path for downloads'),
  filenames: z
    .array(z.string())
    .optional()
    .describe('Optional array of custom filenames (same length as urls)'),
  maxRetries: z
    .number()
    .optional()
    .default(3)
    .describe('Maximum number of retry attempts for failed downloads'),
  retryDelay: z
    .number()
    .optional()
    .default(1000)
    .describe('Base delay in milliseconds between retry attempts'),
  timeout: z
    .number()
    .optional()
    .default(30000)
    .describe('Request timeout in milliseconds'),
  concurrency: z
    .number()
    .optional()
    .default(5)
    .describe('Maximum number of parallel downloads'),
});

export type DownloadFilesInput = z.infer<typeof downloadFilesSchema>;

interface DownloadResult {
  url: string;
  filepath: string;
  filename: string;
  size: number;
  success: boolean;
  error?: string;
}

interface DownloadFilesResult {
  content: [
    {
      type: 'text';
      text: string;
    },
  ];
}

export async function downloadFilesTool(
  input: DownloadFilesInput
): Promise<DownloadFilesResult> {
  const limit = pLimit(input.concurrency);

  try {
    // Validate directory path to prevent directory traversal
    const resolvedDir = path.resolve(input.directory);

    // Ensure directory exists
    await fs.mkdir(resolvedDir, { recursive: true });

    // Check if directory is writable
    await fs.access(resolvedDir, fs.constants.W_OK);

    // Validate filenames if provided
    if (input.filenames && input.filenames.length !== input.urls.length) {
      throw new Error(
        'Filenames array must have the same length as URLs array'
      );
    }

    const tasks = input.urls.map((url, index) =>
      limit(async () => {
        try {
          const filename =
            input.filenames?.[index] || extractFilenameFromUrl(url);
          const filepath = path.join(resolvedDir, filename);

          // Validate file path to prevent directory traversal
          const resolvedFilepath = path.resolve(filepath);
          if (!resolvedFilepath.startsWith(resolvedDir)) {
            throw new Error(
              `Invalid file path: ${filename} would escape directory`
            );
          }

          return await withRetry(
            () => downloadFile(url, resolvedFilepath, input.timeout),
            input.maxRetries,
            input.retryDelay
          );
        } catch (error) {
          return {
            url,
            filepath: '',
            filename: input.filenames?.[index] || '',
            size: 0,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          } as DownloadResult;
        }
      })
    );

    const results = await Promise.all(tasks);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(results, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            [
              {
                url: '',
                filepath: '',
                filename: '',
                size: 0,
                success: false,
                error: error instanceof Error ? error.message : String(error),
              },
            ],
            null,
            2
          ),
        },
      ],
    };
  }
}

async function downloadFile(
  url: string,
  filepath: string,
  timeout: number
): Promise<DownloadResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Create write stream for the file
    const fileStream = fsSync.createWriteStream(filepath);

    // Pipe response body to file stream
    if (response.body) {
      // Use type assertion to Readable stream
      const readable = response.body as import('stream').Readable;
      readable.pipe(fileStream);
    } else {
      throw new Error('Response body is null');
    }

    // Wait for the write stream to finish
    await new Promise<void>((resolve, reject) => {
      fileStream.on('finish', resolve);
      fileStream.on('error', reject);
    });

    // Get file stats to determine size
    const stats = await fs.stat(filepath);

    return {
      url,
      filepath,
      filename: path.basename(filepath),
      size: stats.size,
      success: true,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

function extractFilenameFromUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);
    const pathname = parsedUrl.pathname;
    const filename = path.basename(pathname);

    // If no filename found, use a default name with extension based on content-type
    if (!filename || filename === '/') {
      return `download_${Date.now()}`;
    }

    return filename;
  } catch {
    // Fallback to a default name if URL parsing fails
    return `download_${Date.now()}`;
  }
}
