export async function interruptibleSleep(ms: number, checkCancel?: () => boolean | string | null): Promise<boolean | string> {
  const steps = Math.ceil(ms / 500);
  for (let i = 0; i < steps; i++) {
    const val = checkCancel && checkCancel();
    if (val) return val; // Return true (cancel) or 'SKIP_FILE'
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return false;
}

export interface RetryOptions {
  maxRetries?: number;
  onProgress?: ((progress: { status: string; message: string; waitTime?: number }) => void) | null;
  checkCancel?: (() => boolean | string | null) | null;
}

// Shared retry utility that handles both simple retries and interruptible/progress-reporting retries
export async function executeWithRetry<T>(apiCall: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { maxRetries = 3, onProgress = null, checkCancel = null } = options;
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      if (checkCancel) {
        const apiPromise = apiCall();
        const cancelPromise = new Promise<never>((_, reject) => {
          const interval = setInterval(() => {
            const cancelVal = checkCancel();
            if (cancelVal === 'SKIP_FILE') {
              clearInterval(interval);
              reject(new Error('FILE_SKIPPED'));
            } else if (cancelVal === true) {
              clearInterval(interval);
              reject(new Error('JOB_CANCELLED'));
            }
          }, 500);
          apiPromise.finally(() => clearInterval(interval)).catch(() => {});
        });
        return await Promise.race([apiPromise, cancelPromise]);
      } else {
        return await apiCall();
      }
    } catch (error: any) {
      attempt++;
      
      const cancelVal = checkCancel && checkCancel();
      if (cancelVal === 'SKIP_FILE') {
        throw new Error('FILE_SKIPPED');
      } else if (cancelVal === true) {
        throw new Error('JOB_CANCELLED');
      }

      const isRateLimit = error?.status === 429 || (error?.message && error.message.includes('429'));
      const isServiceUnavailable = error?.status === 503 || (error?.message && error.message.includes('503'));
      
      if ((isRateLimit || isServiceUnavailable) && attempt < maxRetries) {
        let waitTime = attempt * 5000;
        
        if (isRateLimit) {
          waitTime = 65000; // Default 65s to ensure minute window clears
          const match = error.message && error.message.match(/Please retry in ([\d\.]+)s/);
          if (match) {
            waitTime = Math.ceil(parseFloat(match[1])) * 1000 + 5000; // Add 5s buffer
          }
        }

        console.warn(`[API Issue] Retrying attempt ${attempt} in ${waitTime/1000}s...`);
        
        if (onProgress) {
          onProgress({ 
            status: 'quota_wait', 
            message: `API Quota Exceeded. Pausing for ${waitTime/1000}s...`,
            waitTime: waitTime
          });
        }

        const cancelled = await interruptibleSleep(waitTime, checkCancel);
        if (cancelled === true) {
          throw new Error('JOB_CANCELLED');
        } else if (cancelled === 'SKIP_FILE') {
          throw new Error('FILE_SKIPPED');
        }
        
        if (onProgress) {
          onProgress({ status: 'indexing_resumed', message: 'Resuming indexing...' });
        }
      } else {
        if (isRateLimit) {
          throw new Error('Gemini API Quota Exceeded (429). You have exceeded your input token limit. Please wait a minute for the quota to refresh.');
        } else if (isServiceUnavailable) {
          throw new Error('The AI model is currently experiencing high demand (503). Please try again in a few moments.');
        }
        throw error;
      }
    }
  }
  throw new Error('Max retries reached');
}
